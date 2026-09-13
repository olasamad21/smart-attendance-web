from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.face_service import enroll_face, verify_face, delete_face

router = APIRouter()

class FaceEnrollRequest(BaseModel):
    user_id: str
    image: str  # base64 encoded image

class FaceVerifyRequest(BaseModel):
    user_id: str
    image: str  # base64 encoded image

@router.post("/enroll")
async def enroll(request: FaceEnrollRequest):
    if not request.user_id or not request.image:
        raise HTTPException(status_code=400, detail="user_id and image are required")
    result = enroll_face(request.user_id, request.image)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

@router.post("/enroll/add-sample")
async def add_enrollment_sample(request: FaceEnrollRequest):
    """Add another face sample to improve matching accuracy."""
    if not request.user_id or not request.image:
        raise HTTPException(status_code=400, detail="user_id and image are required")
    result = enroll_face(request.user_id, request.image)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

@router.post("/verify")
async def verify(request: FaceVerifyRequest):
    if not request.user_id or not request.image:
        raise HTTPException(status_code=400, detail="user_id and image are required")
    return verify_face(request.user_id, request.image)

@router.delete("/delete/{user_id}")
async def delete(user_id: str):
    result = delete_face(user_id)
    if not result["success"]:
        raise HTTPException(status_code=404, detail=result.get("error", "Not found"))
    return result

@router.get("/status/{user_id}")
async def face_status(user_id: str):
    import os
    face_file = os.path.join(os.getenv("FACE_DATA_DIR", "./face_data"), f"{user_id}.json")
    return {"enrolled": os.path.exists(face_file), "user_id": user_id}
