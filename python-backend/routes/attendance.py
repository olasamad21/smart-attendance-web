from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from services.attendance_service import mark_attendance
from services.firebase import require_uid

router = APIRouter()


class MarkAttendanceRequest(BaseModel):
    session_id: str = Field(min_length=1)
    image: str = Field(min_length=1)          # base64 camera frame
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    accuracy: float | None = Field(default=None, ge=0)


@router.post("/mark")
def mark(request: MarkAttendanceRequest, uid: str = Depends(require_uid)):
    """
    Always responds 200 with a `status` field for business outcomes
    ('recorded', 'face_mismatch', 'out_of_range', 'phase_closed', ...).
    401 = bad/missing token, 422 = malformed request.
    """
    return mark_attendance(uid, request.session_id, request.image,
                           request.latitude, request.longitude, request.accuracy)
