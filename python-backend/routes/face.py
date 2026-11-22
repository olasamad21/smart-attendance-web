from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from services.face_service import enroll_face, delete_face, is_enrolled
from services.firebase import require_uid

router = APIRouter()

# The caller's identity always comes from the verified Firebase ID token,
# never from the request — a user can only enroll, check or delete their own face.


class FaceImageRequest(BaseModel):
    image: str  # base64 encoded image


@router.post("/enroll")
def enroll(request: FaceImageRequest, uid: str = Depends(require_uid)):
    if not request.image:
        raise HTTPException(status_code=400, detail="image is required")
    result = enroll_face(uid, request.image)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/status")
def face_status(uid: str = Depends(require_uid)):
    return {"enrolled": is_enrolled(uid)}


@router.delete("/me")
def delete(uid: str = Depends(require_uid)):
    result = delete_face(uid)
    if not result["success"]:
        raise HTTPException(status_code=404, detail=result.get("error", "Not found"))
    return result
