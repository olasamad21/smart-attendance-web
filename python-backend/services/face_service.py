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

import math
from datetime import datetime, timezone
from firebase_admin import firestore

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371e3
    phi1 = lat1 * math.pi / 180
    phi2 = lat2 * math.pi / 180
    delta_phi = (lat2 - lat1) * math.pi / 180
    delta_lambda = (lon2 - lon1) * math.pi / 180
    a = math.sin(delta_phi/2) * math.sin(delta_phi/2) + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda/2) * math.sin(delta_lambda/2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

def verify_and_check_in(user_id: str, base64_image: str, session_id: str, lat: float, lon: float) -> dict:
    from firebase_config import db
    
    session_ref = db.collection("sessions").document(session_id)
    session_doc = session_ref.get()
    if not session_doc.exists:
        return {"success": False, "error_type": "SESSION_NOT_FOUND", "message": "Session not found."}
    
    session_data = session_doc.to_dict()
    
    # 1. Session Status Validation
    now = datetime.now(timezone.utc)
    p1_end = session_data.get("phase1End")
    p2_start = session_data.get("phase2Start")
    p2_end = session_data.get("phase2End")
    
    current_phase = None
    if p1_end and now <= p1_end:
        current_phase = "phase1"
    elif p2_start and p2_end and p2_start <= now <= p2_end:
        current_phase = "phase2"
    elif p1_end and p2_start and p1_end < now < p2_start:
        return {"success": False, "error_type": "WAITING_PERIOD", "message": "Sign out is not open yet."}
    else:
        return {"success": False, "error_type": "SESSION_EXPIRED", "message": "Session has expired."}
        
    # 2. GPS Validation
    target_lat = session_data.get("classroomLat", 0)
    target_lon = session_data.get("classroomLng", 0)
    target_radius = session_data.get("classroomRadius", 50)
    
    distance = calculate_distance(lat, lon, target_lat, target_lon)
    if distance > target_radius:
        return {"success": False, "error_type": "GPS_OUT_OF_RANGE", "message": f"You are {round(distance)}m away (max {target_radius}m allowed)"}
        
    # 3. Face Verification
    face_result = verify_face(user_id, base64_image)
    if not face_result.get("matched"):
        error_msg = face_result.get("error", "Face did not match.")
        return {"success": False, "error_type": "FACE_MISMATCH", "message": error_msg}
        
    confidence = face_result.get("confidence", 0)
    
    # 4. Duplicate Check & DB Write
    # We use a deterministic document ID to prevent race conditions
    doc_id = f"{session_id}_{user_id}"
    attendance_ref = db.collection("attendance").document(doc_id)
    
    try:
        if current_phase == "phase1":
            # get user to get name/matric
            user_doc = db.collection("users").document(user_id).get()
            user_data = user_doc.to_dict() or {}
            
            # create will fail if document already exists
            attendance_ref.create({
                "attendanceId": doc_id,
                "sessionId": session_id,
                "courseId": session_data.get("courseId"),
                "studentId": user_id,
                "studentName": user_data.get("name", "Unknown"),
                "matricNumber": user_data.get("matricNumber", ""),
                "phase1Score": 3,
                "phase1Status": "present",
                "phase1Time": firestore.SERVER_TIMESTAMP,
                "faceMatchConfidence": confidence,
                "gpsDistance": round(distance),
                "phase2Score": 0,
                "phase2Status": "absent",
                "phase2Time": None,
                "totalScore": 3,
                "remark": "Present",
                "timestamp": firestore.SERVER_TIMESTAMP
            })
        elif current_phase == "phase2":
            # fetch the doc to see if they completed phase 1
            att_doc = attendance_ref.get()
            if not att_doc.exists:
                return {"success": False, "error_type": "NO_PHASE1_RECORD", "message": "You did not sign in during Phase 1."}
            
            att_data = att_doc.to_dict()
            if att_data.get("phase2Status") == "present":
                return {"success": False, "error_type": "ALREADY_CHECKED_IN", "message": "You have already signed out."}
                
            attendance_ref.update({
                "phase2Status": "present",
                "phase2Score": 2,
                "phase2Time": firestore.SERVER_TIMESTAMP,
                "totalScore": att_data.get("phase1Score", 3) + 2
            })
            
    except Exception as e:
        if "ALREADY_EXISTS" in str(e):
            return {"success": False, "error_type": "ALREADY_CHECKED_IN", "message": "You have already signed in."}
        raise e
        
    return {"success": True, "message": "Check-in successful!"}

