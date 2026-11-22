import os
import base64
import io
import json

import numpy as np
from PIL import Image
from deepface import DeepFace
from google.cloud.firestore_v1 import SERVER_TIMESTAMP

from services.firebase import get_db

# Legacy on-disk store — only read for one-time migration into Firestore.
FACE_DATA_DIR = os.getenv("FACE_DATA_DIR", "./face_data")

# Embeddings live in a server-only collection (Firestore rules deny all client access).
FACE_COLLECTION = "face_embeddings"

# Tunable threshold — higher = stricter matching
MATCH_THRESHOLD = float(os.getenv("MATCH_THRESHOLD", "0.65"))

MAX_SAMPLES = 5
MODEL_NAME = "Facenet512"
DETECTOR = "skip"


def base64_to_image(base64_str: str) -> np.ndarray:
    if "," in base64_str:
        base64_str = base64_str.split(",")[1]
    img_bytes = base64.b64decode(base64_str)
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    return np.array(img)


def get_embedding(img_array: np.ndarray, enforce: bool = True) -> list | None:
    """Get face embedding from image array. Returns None if no face detected."""
    try:
        result = DeepFace.represent(
            img_path=img_array,
            model_name=MODEL_NAME,
            enforce_detection=enforce,
            detector_backend=DETECTOR,
        )
        if result and len(result) > 0:
            return result[0]["embedding"]
        return None
    except Exception as e:
        error_msg = str(e)
        if "Face could not be detected" in error_msg or "No face" in error_msg.lower():
            return None
        raise e


def cosine_similarity(a: list, b: list) -> float:
    """Returns similarity between 0 and 1. Higher = more similar."""
    a_arr = np.array(a)
    b_arr = np.array(b)
    norm = np.linalg.norm(a_arr) * np.linalg.norm(b_arr)
    if norm == 0:
        return 0.0
    return float(np.dot(a_arr, b_arr) / norm)


# ── Storage ──────────────────────────────────────────────────────────────────
# Firestore forbids arrays-of-arrays, so samples are stored as [{"v": [...]}, ...].

def _doc(user_id: str):
    return get_db().collection(FACE_COLLECTION).document(user_id)


def _migrate_legacy_file(user_id: str) -> dict | None:
    """Move a legacy ./face_data/<uid>.json record into Firestore, then delete the file."""
    path = os.path.join(FACE_DATA_DIR, f"{user_id}.json")
    if not os.path.exists(path):
        return None
    with open(path, "r") as f:
        legacy = json.load(f)
    samples = legacy.get("embeddings") or [legacy.get("embedding", [])]
    samples = [s for s in samples if s][-MAX_SAMPLES:]
    if not samples:
        return None
    record = _build_record(samples)
    _doc(user_id).set({**record, "updatedAt": SERVER_TIMESTAMP, "migratedFromFile": True})
    try:
        os.remove(path)
    except OSError:
        pass
    return record


def _build_record(samples: list[list[float]]) -> dict:
    return {
        "embeddings": [{"v": s} for s in samples],
        "embedding": np.mean(samples, axis=0).tolist(),  # averaged embedding used for matching
        "sample_count": len(samples),
        "model": MODEL_NAME,
    }


def load_face_record(user_id: str) -> dict | None:
    snap = _doc(user_id).get()
    if snap.exists:
        return snap.to_dict()
    return _migrate_legacy_file(user_id)


def is_enrolled(user_id: str) -> bool:
    return load_face_record(user_id) is not None


# ── Public operations ────────────────────────────────────────────────────────

def enroll_face(user_id: str, base64_image: str) -> dict:
    """
    Enroll a face sample. Repeated calls keep up to MAX_SAMPLES samples and
    average them for more robust matching.
    """
    try:
        img_array = base64_to_image(base64_image)
        embedding = get_embedding(img_array, enforce=True)

        if embedding is None:
            return {
                "success": False,
                "error": "No face detected. Please ensure your face is clearly visible, well-lit, and centered in the frame.",
            }

        existing = load_face_record(user_id)
        samples = [s["v"] for s in existing.get("embeddings", [])] if existing else []
        samples.append(embedding)
        samples = samples[-MAX_SAMPLES:]

        _doc(user_id).set({**_build_record(samples), "updatedAt": SERVER_TIMESTAMP})

        n = len(samples)
        return {
            "success": True,
            "message": f"Face enrolled successfully ({n} sample{'s' if n > 1 else ''} averaged)",
            "sample_count": n,
        }

    except Exception as e:
        if "Face could not be detected" in str(e):
            return {"success": False, "error": "No face detected. Ensure good lighting and your face is clearly visible."}
        return {"success": False, "error": f"Enrollment failed: {e}"}


def verify_face(user_id: str, base64_image: str) -> dict:
    """
    Verify a face against the stored embedding (cosine similarity vs threshold).
    Returns matched status, confidence percentage and threshold.
    """
    try:
        stored = load_face_record(user_id)
        if not stored:
            return {"matched": False, "confidence": 0.0, "not_enrolled": True,
                    "error": "Face not enrolled. Please complete face enrollment first."}

        verify_embedding = get_embedding(base64_to_image(base64_image), enforce=True)
        if verify_embedding is None:
            return {"matched": False, "confidence": 0.0, "no_face": True,
                    "error": "No face detected in verification image. Look directly at the camera."}

        similarity = cosine_similarity(stored["embedding"], verify_embedding)
        return {
            "matched": similarity >= MATCH_THRESHOLD,
            "confidence": round(similarity * 100, 2),
            "threshold": round(MATCH_THRESHOLD * 100, 1),
            "sample_count": stored.get("sample_count", 1),
        }

    except Exception as e:
        if "Face could not be detected" in str(e):
            return {"matched": False, "confidence": 0.0, "no_face": True,
                    "error": "No face detected. Ensure good lighting and look directly at the camera."}
        return {"matched": False, "confidence": 0.0, "error": f"Verification failed: {e}"}


def delete_face(user_id: str) -> dict:
    ref = _doc(user_id)
    legacy = os.path.join(FACE_DATA_DIR, f"{user_id}.json")
    found = ref.get().exists or os.path.exists(legacy)
    ref.delete()
    if os.path.exists(legacy):
        os.remove(legacy)
    return {"success": True} if found else {"success": False, "error": "No face data found"}
