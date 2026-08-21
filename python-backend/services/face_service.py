import os
import base64
import numpy as np
from PIL import Image
import io
import json
from deepface import DeepFace

FACE_DATA_DIR = os.getenv("FACE_DATA_DIR", "./face_data")
os.makedirs(FACE_DATA_DIR, exist_ok=True)

# Tunable threshold — lower = stricter matching
MATCH_THRESHOLD = float(os.getenv("MATCH_THRESHOLD", "0.65"))

# Number of enrollment photos to capture and average
ENROLLMENT_SAMPLES = int(os.getenv("ENROLLMENT_SAMPLES", "1"))

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
            detector_backend=DETECTOR
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
    dot = np.dot(a_arr, b_arr)
    norm = np.linalg.norm(a_arr) * np.linalg.norm(b_arr)
    if norm == 0:
        return 0.0
    return float(dot / norm)


def enroll_face(user_id: str, base64_image: str) -> dict:
    """
    Enroll a student face.
    Stores the embedding. If called multiple times, averages all embeddings
    for more robust matching (multi-sample enrollment).
    """
    try:
        img_array = base64_to_image(base64_image)
        embedding = get_embedding(img_array, enforce=True)

        if embedding is None:
            return {
                "success": False,
                "error": "No face detected. Please ensure your face is clearly visible, well-lit, and centered in the frame."
            }

        face_file = os.path.join(FACE_DATA_DIR, f"{user_id}.json")

        # Multi-sample: if previous enrollment exists, average the embeddings
        if os.path.exists(face_file):
            with open(face_file, "r") as f:
                stored = json.load(f)
            existing_embeddings = stored.get("embeddings", [stored.get("embedding", [])])
            existing_embeddings.append(embedding)
            # Keep last 5 samples max
            existing_embeddings = existing_embeddings[-5:]
        else:
            existing_embeddings = [embedding]

        # Average all embeddings for robustness
        averaged = np.mean(existing_embeddings, axis=0).tolist()

        with open(face_file, "w") as f:
            json.dump({
                "user_id": user_id,
                "embedding": averaged,        # averaged embedding for matching
                "embeddings": existing_embeddings,  # raw samples
                "sample_count": len(existing_embeddings),
                "model": MODEL_NAME,
            }, f)

        return {
            "success": True,
            "message": f"Face enrolled successfully ({len(existing_embeddings)} sample{'s' if len(existing_embeddings) > 1 else ''} averaged)",
            "sample_count": len(existing_embeddings)
        }

    except Exception as e:
        error_msg = str(e)
        if "Face could not be detected" in error_msg:
            return {
                "success": False,
                "error": "No face detected. Ensure good lighting and your face is clearly visible."
            }
        return {"success": False, "error": f"Enrollment failed: {error_msg}"}


def verify_face(user_id: str, base64_image: str) -> dict:
    """
    Verify a face against stored embedding.
    Uses cosine similarity with configurable threshold.
    Returns matched status, confidence percentage, and distance.
    """
    try:
        face_file = os.path.join(FACE_DATA_DIR, f"{user_id}.json")
        if not os.path.exists(face_file):
            return {
                "matched": False,
                "confidence": 0.0,
                "error": "Face not enrolled. Please complete face enrollment first."
            }

        with open(face_file, "r") as f:
            stored = json.load(f)
        stored_embedding = stored["embedding"]

        img_array = base64_to_image(base64_image)
        verify_embedding = get_embedding(img_array, enforce=True)

        if verify_embedding is None:
            return {
                "matched": False,
                "confidence": 0.0,
                "error": "No face detected in verification image. Look directly at the camera."
            }

        # Cosine similarity — higher is better
        similarity = cosine_similarity(stored_embedding, verify_embedding)

        # Convert to 0-100 confidence percentage
        confidence = round(similarity * 100, 2)

        matched = similarity >= MATCH_THRESHOLD

        return {
            "matched": matched,
            "confidence": confidence,
            "threshold": round(MATCH_THRESHOLD * 100, 1),
            "sample_count": stored.get("sample_count", 1),
        }

    except Exception as e:
        error_msg = str(e)
        if "Face could not be detected" in error_msg:
            return {
                "matched": False,
                "confidence": 0.0,
                "error": "No face detected. Ensure good lighting and look directly at the camera."
            }
        return {"matched": False, "confidence": 0.0, "error": f"Verification failed: {error_msg}"}


def delete_face(user_id: str) -> dict:
    face_file = os.path.join(FACE_DATA_DIR, f"{user_id}.json")
    if os.path.exists(face_file):
        os.remove(face_file)
        return {"success": True}
    return {"success": False, "error": "No face data found"}
