"""
Server-authoritative attendance marking.

The student's browser only submits evidence (a camera frame + a GPS fix). The server
decides everything else — which phase is open, whether the student is enrolled, whether
they are inside the classroom radius, whether the face matches, and how many marks to
award — and is the only party allowed to write the student's attendance record.
"""
import math
from datetime import datetime, timedelta, timezone

from google.cloud.firestore_v1 import SERVER_TIMESTAMP, FieldFilter, Increment, transactional

from services.face_service import verify_face
from services.firebase import get_db

GRACE_SECONDS = 45          # submissions are accepted this long after a phase closes
MAX_FACE_ATTEMPTS = 3       # face mismatches allowed per student, per session phase
DEFAULT_PHASE1_MARKS = 3
DEFAULT_PHASE2_MARKS = 2

# Location rules — keep in sync with lib/utils/gps.utils.ts.
MAX_ACCURACY_M = 100        # fixes less precise than this are rejected (indoor Wi-Fi guesses)
MAX_TOLERANCE_M = 50        # reported GPS error granted as tolerance, capped
IMPOSSIBLE_SPEED_MPS = 83   # ~300 km/h between two check-ins = flagged


def attendance_doc_id(session_id: str, student_id: str) -> str:
    """Deterministic id — one record per student per session, so duplicates are impossible."""
    return f"{session_id}_{student_id}"


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371000.0
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (math.sin(d_lat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng / 2) ** 2)
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def resolve_open_phase(session: dict, now: datetime | None = None) -> str | None:
    """
    Which phase ('phase1' | 'phase2') currently accepts submissions, or None.
    Mirrors resolveSessionPhase() on the client, plus a short grace window so a student
    who was mid-verification when a phase closed is not penalised.
    """
    now = now or datetime.now(timezone.utc)
    grace = timedelta(seconds=GRACE_SECONDS)
    p1_end, p2_start, p2_end = session.get("phase1End"), session.get("phase2Start"), session.get("phase2End")
    if not (p1_end and p2_start and p2_end):
        return None

    if session.get("status") == "ended":
        # endSession() stamps phase2End with the actual end time.
        if now > p2_end + grace:
            return None
        if p2_end >= p2_start:
            return "phase2"
        if p2_end <= p1_end:
            return "phase1"
        return None  # ended during the waiting period

    if now < p1_end:
        return "phase1"
    if now < p2_start:
        return "phase1" if now <= p1_end + grace else None
    if now < p2_end:
        return "phase2"
    return "phase2" if now <= p2_end + grace else None


def check_location(distance: float, accuracy: float | None, radius: float) -> str | None:
    """None if acceptable, else 'low_accuracy' | 'out_of_range'."""
    if accuracy is not None and accuracy > MAX_ACCURACY_M:
        return "low_accuracy"
    tolerance = min(accuracy or 0, MAX_TOLERANCE_M)
    return "out_of_range" if distance - tolerance > radius else None


def _decimals(x: float) -> int:
    text = repr(float(x))
    return len(text.split(".")[1].rstrip("0")) if "." in text else 0


def gps_flags(latitude: float, longitude: float, accuracy: float | None,
              previous: dict | None = None, now: datetime | None = None) -> list[str]:
    """
    Signs of a faked location. These never block a check-in — they are stored on the record
    so the lecturer can review them.
    """
    flags = []
    if accuracy is None:
        flags.append("accuracy_missing")
    elif accuracy < 2:
        flags.append("accuracy_too_precise")      # mock-location apps often report 0–1 m
    elif accuracy > MAX_TOLERANCE_M:
        flags.append("low_accuracy")
    if _decimals(latitude) <= 4 and _decimals(longitude) <= 4:
        flags.append("coordinates_too_round")     # real GPS fixes carry 6+ decimals
    if previous and previous.get("point") and previous.get("time"):
        now = now or datetime.now(timezone.utc)
        seconds = max((now - previous["time"]).total_seconds(), 1)
        moved = haversine_m(latitude, longitude, previous["point"]["lat"], previous["point"]["lng"])
        if moved > 2000 and moved / seconds > IMPOSSIBLE_SPEED_MPS:
            flags.append("impossible_travel")
    return flags


def _previous_location(db, student_id: str, exclude_session: str) -> dict | None:
    """Most recent stored check-in position for this student from another session."""
    docs = (db.collection("attendance")
            .where(filter=FieldFilter("studentId", "==", student_id)).get())
    best = None
    for d in docs:
        r = d.to_dict() or {}
        if r.get("sessionId") == exclude_session:
            continue
        for point_key, time_key in (("gpsPoint", "phase1Time"), ("phase2GpsPoint", "phase2Time")):
            if r.get(point_key) and r.get(time_key):
                if best is None or r[time_key] > best["time"]:
                    best = {"point": r[point_key], "time": r[time_key]}
    return best


def _find_record(db, session_id: str, student_id: str):
    """Deterministic doc first; fall back to legacy random-id records."""
    ref = db.collection("attendance").document(attendance_doc_id(session_id, student_id))
    snap = ref.get()
    if snap.exists:
        return snap
    legacy = (db.collection("attendance")
              .where(filter=FieldFilter("sessionId", "==", session_id))
              .where(filter=FieldFilter("studentId", "==", student_id))
              .limit(1).get())
    return legacy[0] if legacy else None


def _result(status: str, message: str, **extra) -> dict:
    return {"status": status, "message": message, **extra}


def mark_attendance(uid: str, session_id: str, image: str, latitude: float, longitude: float,
                    accuracy: float | None = None) -> dict:
    db = get_db()

    # 1. Caller must be a student.
    user_snap = db.collection("users").document(uid).get()
    user = user_snap.to_dict() if user_snap.exists else None
    if not user or user.get("role") != "student":
        return _result("forbidden", "Only students can mark attendance.")

    # 2. Session must exist and have an open phase.
    session_snap = db.collection("sessions").document(session_id).get()
    if not session_snap.exists:
        return _result("no_session", "This attendance session no longer exists.")
    session = session_snap.to_dict()
    course_id = session.get("courseId")
    phase = resolve_open_phase(session)
    if phase is None:
        return _result("phase_closed", "Attendance is not open for this session right now.")

    # 3. Student must be enrolled in the course.
    enrolled = (db.collection("enrollments")
                .where(filter=FieldFilter("courseId", "==", course_id))
                .where(filter=FieldFilter("studentId", "==", uid))
                .limit(1).get())
    if not enrolled:
        return _result("not_enrolled", "You are not enrolled in this course.")

    # 4. Location — computed here, never trusted from the client.
    distance = round(haversine_m(latitude, longitude, session["classroomLat"], session["classroomLng"]))
    radius = session.get("classroomRadius", 100)
    location_problem = check_location(distance, accuracy, radius)
    if location_problem == "low_accuracy":
        return _result("out_of_range",
                       f"Your location is too imprecise (±{round(accuracy)}m). Move near a window or step outside.",
                       distance=distance, radius=radius, phase=phase)
    if location_problem == "out_of_range":
        return _result("out_of_range", f"You are about {distance}m away (must be within {radius}m).",
                       distance=distance, radius=radius, phase=phase)
    flags = gps_flags(latitude, longitude, accuracy, _previous_location(db, uid, session_id))
    # ~11 m precision: enough for impossible-travel checks, not a precise track of the student.
    point = {"lat": round(latitude, 4), "lng": round(longitude, 4)}

    # 5. Cheap state checks before running the (expensive) face model.
    existing = _find_record(db, session_id, uid)
    existing_data = existing.to_dict() if existing else None
    if phase == "phase1" and existing_data:
        return _result("already_recorded", "Your check-in for this session is already recorded.", phase=phase)
    if phase == "phase2":
        if not existing_data or not existing_data.get("phase1Score"):
            return _result("no_phase1", "You must check in during Phase 1 before you can check out.", phase=phase)
        if existing_data.get("phase2Status") == "present":
            return _result("already_recorded", "Your check-out for this session is already recorded.", phase=phase)

    attempts_ref = db.collection("attendance_attempts").document(f"{session_id}_{uid}_{phase}")
    attempts_snap = attempts_ref.get()
    failures = (attempts_snap.to_dict() or {}).get("failures", 0) if attempts_snap.exists else 0
    if failures >= MAX_FACE_ATTEMPTS:
        return _result("too_many_attempts",
                       "Face verification failed too many times. Ask your lecturer for a manual check-in.",
                       phase=phase, attempts_remaining=0)

    # 6. Face verification.
    face = verify_face(uid, image)
    if face.get("not_enrolled") or face.get("needs_reenroll"):
        return _result("not_enrolled_face", face["error"], phase=phase, needs_reenroll=bool(face.get("needs_reenroll")))
    if face.get("no_face"):
        return _result("no_face", face["error"], phase=phase, attempts_remaining=MAX_FACE_ATTEMPTS - failures)
    if face.get("error"):
        return _result("error", face["error"], phase=phase)
    confidence = face["confidence"]
    if not face["matched"]:
        attempts_ref.set({"failures": Increment(1), "sessionId": session_id, "studentId": uid,
                          "phase": phase, "updatedAt": SERVER_TIMESTAMP}, merge=True)
        remaining = MAX_FACE_ATTEMPTS - failures - 1
        return _result("face_mismatch",
                       f"Face did not match ({confidence:.1f}% confidence, {face['threshold']}% required).",
                       phase=phase, confidence=confidence, threshold=face["threshold"],
                       attempts_remaining=max(remaining, 0))

    # 7. Write the record atomically.
    course_snap = db.collection("courses").document(course_id).get()
    course = course_snap.to_dict() if course_snap.exists else {}
    p1_marks = course.get("phase1Marks", DEFAULT_PHASE1_MARKS)
    p2_marks = course.get("phase2Marks", DEFAULT_PHASE2_MARKS)

    if phase == "phase1":
        ref = db.collection("attendance").document(attendance_doc_id(session_id, uid))
        record = {
            "attendanceId": ref.id,
            "sessionId": session_id,
            "courseId": course_id,
            "studentId": uid,
            "studentName": user.get("name", ""),
            "matricNumber": user.get("matricNumber", ""),
            "phase1Score": p1_marks,
            "phase1Status": "present",
            "phase1Time": SERVER_TIMESTAMP,
            "faceMatchConfidence": confidence,
            "gpsDistance": distance,
            "gpsAccuracy": accuracy,
            "gpsFlags": flags,
            "gpsPoint": point,
            "phase2Score": 0,
            "phase2Time": None,
            "phase2Status": "absent",
            "totalScore": p1_marks,
            "remark": "Present",
            "timestamp": SERVER_TIMESTAMP,
            "phase1VerificationMethod": "face_gps",
        }

        @transactional
        def create(txn):
            if ref.get(transaction=txn).exists:
                return False
            txn.set(ref, record)
            return True

        if not create(db.transaction()):
            return _result("already_recorded", "Your check-in for this session is already recorded.", phase=phase)
        return _result("recorded", "Check-in recorded.", phase=phase, score=p1_marks,
                       confidence=confidence, distance=distance)

    ref = existing.reference

    @transactional
    def update(txn):
        current = ref.get(transaction=txn).to_dict() or {}
        if current.get("phase2Status") == "present":
            return False
        txn.update(ref, {
            "phase2Score": p2_marks,
            "phase2Time": SERVER_TIMESTAMP,
            "phase2Status": "present",
            "phase2Confidence": confidence,
            "phase2GpsDistance": distance,
            "phase2GpsAccuracy": accuracy,
            "phase2GpsFlags": flags,
            "phase2GpsPoint": point,
            "totalScore": (current.get("phase1Score") or 0) + p2_marks,
            "remark": "Present",
            "phase2VerificationMethod": "face_gps",
        })
        return True

    if not update(db.transaction()):
        return _result("already_recorded", "Your check-out for this session is already recorded.", phase=phase)
    return _result("recorded", "Check-out recorded.", phase=phase, score=p2_marks,
                   confidence=confidence, distance=distance)
