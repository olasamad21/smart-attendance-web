from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from services.face_service import enroll_faces, delete_face, face_status
from services.firebase import require_uid

router = APIRouter()

# The caller's identity always comes from the verified Firebase ID token,
# never from the request — a user can only enroll, check or delete their own face.


class FaceEnrollRequest(BaseModel):
    # base64 aligned face crops, one per pose (front / left / right / ...)
    images: list[str] = Field(min_length=3, max_length=6)


@router.post("/enroll")
def enroll(request: FaceEnrollRequest, uid: str = Depends(require_uid)):
    result = enroll_faces(uid, request.images)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/status")
def status(uid: str = Depends(require_uid)):
    return face_status(uid)


@router.delete("/me")
def delete(uid: str = Depends(require_uid)):
    result = delete_face(uid)
    if not result["success"]:
        raise HTTPException(status_code=404, detail=result.get("error", "Not found"))
    return result
