"""
Face enrollment and verification.

Pipeline v2:
  * The browser sends tight, eye-aligned face crops (MediaPipe) that already passed
    quality and liveness checks.
  * The server re-detects and aligns the face in each crop (MTCNN by default — on CPU it
    takes ~0.2 s vs ~19 s for RetinaFace, and the crops are already tight) and embeds it
    with Facenet512.
  * Enrollment stores 3–5 separate pose samples (front / left / right ...). Verification
    compares against every sample and uses the best match, instead of one averaged vector.
  * Confident matches add an "adaptive" sample (capped) so the template keeps up with
    small appearance changes (glasses, haircut).

Records from older pipelines (v1: single full-frame photo; v2: RetinaFace) are not
compatible with the current embeddings, so those users are asked to re-enroll.
"""
import base64
import io
import itertools
import json
import os

import numpy as np
from PIL import Image
from deepface import DeepFace
from google.cloud.firestore_v1 import SERVER_TIMESTAMP

from services.firebase import get_db

PIPELINE_VERSION = 3  # v3: MTCNN detector (v2 used RetinaFace — ~80x slower on CPU)
MODEL_NAME = "Facenet512"
DETECTOR = os.getenv("FACE_DETECTOR", "mtcnn")

# Cosine similarity needed to accept a match. 0.70 == DeepFace's published Facenet512
# cosine-distance threshold (0.30). Tune with `python -m scripts.face_calibration`.
MATCH_THRESHOLD = float(os.getenv("MATCH_THRESHOLD", "0.70"))
# A match this far above the threshold is trusted enough to become an adaptive sample.
ADAPTIVE_MARGIN = float(os.getenv("ADAPTIVE_MARGIN", "0.08"))
MAX_ADAPTIVE_SAMPLES = 3

MIN_ENROLL_SAMPLES = 3
MAX_ENROLL_SAMPLES = 6
# Every enrollment sample must resemble the others at least this much (same person, usable photo).
MIN_SAMPLE_CONSISTENCY = float(os.getenv("MIN_SAMPLE_CONSISTENCY", "0.50"))

FACE_COLLECTION = "face_embeddings"
FACE_DATA_DIR = os.getenv("FACE_DATA_DIR", "./face_data")  # legacy, migration only


# ── Embeddings ───────────────────────────────────────────────────────────────

def base64_to_image(base64_str: str) -> np.ndarray:
    if "," in base64_str:
        base64_str = base64_str.split(",", 1)[1]
    img = Image.open(io.BytesIO(base64.b64decode(base64_str))).convert("RGB")
    # DeepFace expects BGR arrays (OpenCV convention).
    return np.array(img)[:, :, ::-1]


def get_embedding(img_array: np.ndarray) -> list | None:
    """Embedding of the single most prominent face in the crop, or None if no face found."""
    try:
        result = DeepFace.represent(
            img_path=img_array,
            model_name=MODEL_NAME,
            detector_backend=DETECTOR,
            enforce_detection=True,
            align=True,
        )
    except ValueError as e:
        if "Face could not be detected" in str(e) or "no face" in str(e).lower():
            return None
        raise
    if not result:
        return None
    best = max(result, key=lambda r: (r.get("facial_area") or {}).get("w", 0) * (r.get("facial_area") or {}).get("h", 0))
    return best["embedding"]


def cosine_similarity(a: list, b: list) -> float:
    a_arr, b_arr = np.asarray(a), np.asarray(b)
    norm = np.linalg.norm(a_arr) * np.linalg.norm(b_arr)
    return float(np.dot(a_arr, b_arr) / norm) if norm else 0.0


def warmup() -> float:
    """
    Load TensorFlow, RetinaFace and Facenet512 and run one inference of each, so the
    first student's check-in doesn't pay the multi-minute cold start. Returns seconds taken.
    """
    import time
    start = time.time()
    blank = np.full((160, 160, 3), 128, dtype=np.uint8)
    DeepFace.represent(img_path=blank, model_name=MODEL_NAME, detector_backend="skip", enforce_detection=False)
    try:
        DeepFace.represent(img_path=blank, model_name=MODEL_NAME, detector_backend=DETECTOR, enforce_detection=True)
    except ValueError:
        pass  # no face in a blank image — expected; the detector is now loaded
    return time.time() - start


# ── Storage ──────────────────────────────────────────────────────────────────
# Firestore forbids arrays-of-arrays, so samples are stored as [{"v": [...]}, ...].

def _doc(user_id: str):
    return get_db().collection(FACE_COLLECTION).document(user_id)


def _migrate_legacy_file(user_id: str) -> dict | None:
    """Move a legacy ./face_data/<uid>.json record into Firestore (as pipeline v1)."""
    path = os.path.join(FACE_DATA_DIR, f"{user_id}.json")
    if not os.path.exists(path):
        return None
    with open(path, "r") as f:
        legacy = json.load(f)
    samples = [s for s in (legacy.get("embeddings") or [legacy.get("embedding", [])]) if s][-5:]
    if not samples:
        return None
    record = {"samples": [{"v": s} for s in samples], "pipeline": 1, "model": MODEL_NAME,
              "migratedFromFile": True}
    _doc(user_id).set({**record, "updatedAt": SERVER_TIMESTAMP})
    try:
        os.remove(path)
    except OSError:
        pass
    return record


def load_face_record(user_id: str) -> dict | None:
    snap = _doc(user_id).get()
    return snap.to_dict() if snap.exists else _migrate_legacy_file(user_id)


def face_status(user_id: str) -> dict:
    record = load_face_record(user_id)
    if not record:
        return {"enrolled": False, "needs_reenroll": False}
    current = record.get("pipeline") == PIPELINE_VERSION
    return {"enrolled": current, "needs_reenroll": not current,
            "sample_count": len(record.get("samples", []))}


def is_enrolled(user_id: str) -> bool:
    return face_status(user_id)["enrolled"]


# ── Public operations ────────────────────────────────────────────────────────

def enroll_faces(user_id: str, images: list[str]) -> dict:
    """
    Replace the user's face template with a fresh multi-pose enrollment.
    Rejects the set if too few faces are usable or the samples don't look like one person.
    """
    if not (MIN_ENROLL_SAMPLES <= len(images) <= MAX_ENROLL_SAMPLES):
        return {"success": False, "error": f"Send between {MIN_ENROLL_SAMPLES} and {MAX_ENROLL_SAMPLES} photos."}

    embeddings = []
    for image in images:
        try:
            emb = get_embedding(base64_to_image(image))
        except Exception as e:  # corrupt image, model error
            return {"success": False, "error": f"Could not process a photo: {e}"}
        if emb is not None:
            embeddings.append(emb)

    if len(embeddings) < MIN_ENROLL_SAMPLES:
        return {"success": False,
                "error": "Your face wasn't clear in enough photos. Use good, even lighting and try again."}

    # Consistency: each sample's average similarity to the others.
    for i, emb in enumerate(embeddings):
        others = [cosine_similarity(emb, o) for j, o in enumerate(embeddings) if j != i]
        if np.mean(others) < MIN_SAMPLE_CONSISTENCY:
            return {"success": False,
                    "error": "The photos didn't match each other well. Keep only your face in view and try again."}

    pair_sims = [cosine_similarity(a, b) for a, b in itertools.combinations(embeddings, 2)]
    _doc(user_id).set({
        "samples": [{"v": e} for e in embeddings],
        "adaptive": [],
        "pipeline": PIPELINE_VERSION,
        "model": MODEL_NAME,
        "detector": DETECTOR,
        "enrollConsistency": round(float(np.mean(pair_sims)), 4),
        "updatedAt": SERVER_TIMESTAMP,
    })
    return {"success": True, "sample_count": len(embeddings),
            "message": f"Face enrolled with {len(embeddings)} photos."}


def verify_face(user_id: str, base64_image: str) -> dict:
    """Compare one aligned face crop against the user's enrolled samples (best match wins)."""
    record = load_face_record(user_id)
    if not record:
        return {"matched": False, "confidence": 0.0, "not_enrolled": True,
                "error": "Face not enrolled. Please complete face enrollment first."}
    if record.get("pipeline") != PIPELINE_VERSION:
        return {"matched": False, "confidence": 0.0, "needs_reenroll": True,
                "error": "Face verification was upgraded. Please set up your face again (takes 20 seconds)."}

    try:
        probe = get_embedding(base64_to_image(base64_image))
    except Exception as e:
        return {"matched": False, "confidence": 0.0, "error": f"Verification failed: {e}"}
    if probe is None:
        return {"matched": False, "confidence": 0.0, "no_face": True,
                "error": "No face detected. Face the camera in good light."}

    enrolled = [s["v"] for s in record.get("samples", [])]
    adaptive = [s["v"] for s in record.get("adaptive", [])]
    best_enrolled = max((cosine_similarity(probe, s) for s in enrolled), default=0.0)
    best_adaptive = max((cosine_similarity(probe, s) for s in adaptive), default=0.0)
    best = max(best_enrolled, best_adaptive)
    matched = best >= MATCH_THRESHOLD

    # Only learn from matches that are strong against the ORIGINAL enrollment, so the
    # template can't drift toward an impostor through a chain of borderline matches.
    if best_enrolled >= MATCH_THRESHOLD + ADAPTIVE_MARGIN:
        adaptive_entries = (record.get("adaptive", []) + [{"v": probe}])[-MAX_ADAPTIVE_SAMPLES:]
        try:
            _doc(user_id).update({"adaptive": adaptive_entries, "updatedAt": SERVER_TIMESTAMP})
        except Exception:
            pass  # learning is best-effort; never fail a verification over it

    return {
        "matched": matched,
        "confidence": round(best * 100, 2),
        "threshold": round(MATCH_THRESHOLD * 100, 1),
    }


def delete_face(user_id: str) -> dict:
    ref = _doc(user_id)
    legacy = os.path.join(FACE_DATA_DIR, f"{user_id}.json")
    found = ref.get().exists or os.path.exists(legacy)
    ref.delete()
    if os.path.exists(legacy):
        os.remove(legacy)
    return {"success": True} if found else {"success": False, "error": "No face data found"}
