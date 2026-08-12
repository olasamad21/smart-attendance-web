# Facial Recognition Attendance System
## 2-Week Build Plan — Senior Dev Edition
> Stack: Next.js (frontend) + FastAPI (backend) + DeepFace + Firebase + Railway + Vercel

---

## Week Overview

| Days | Focus |
|------|-------|
| Day 1–2 | Cleanup + Python backend setup + face enrollment |
| Day 3–4 | GPS verification + session management |
| Day 5–6 | Two-phase attendance flow |
| Day 7 | Reports + export |
| Day 8–9 | Mobile UI polish |
| Day 10–11 | Testing + bug fixes |
| Day 12–13 | Deploy Railway + Vercel |
| Day 14 | Demo prep + buffer |

---

## Architecture

```
[Mobile Browser]
      ↓
[Next.js Frontend — Vercel]
      ↓ API calls
[FastAPI Backend — Railway]
      ↓              ↓
[DeepFace]    [Firebase Firestore]
(face match)  (users, courses, sessions, attendance)
```

---

## Database Design (Firestore)

```
users/{userId}
  - userId, name, email, role ('lecturer'|'student')
  - matricNumber, department, level
  - faceEnrolled: boolean
  - faceEncoding: string (base64 stored in Firestore or Railway)

courses/{courseId}
  - courseId, courseTitle, courseCode
  - lecturerId, lecturerName
  - level, unit
  - phase1Duration (minutes)
  - phase2Duration (minutes)
  - phase1Marks, phase2Marks
  - createdAt

classrooms/{classroomId}
  - classroomId, name
  - latitude, longitude
  - radius (meters — allowed distance for GPS check)

enrollments/{enrollmentId}
  - courseId, studentId, enrolledAt

sessions/{sessionId}
  - courseId, lecturerId, classroomId
  - classroomName, classroomLat, classroomLng, classroomRadius
  - status: 'phase1_open' | 'waiting' | 'phase2_open' | 'ended'
  - phase1Start, phase1End
  - phase2Start, phase2End
  - createdAt

attendance/{attendanceId}
  - sessionId, courseId, studentId, studentName
  - phase1Score, phase1Time, phase1Status ('present'|'absent'|'failed')
  - phase2Score, phase2Time, phase2Status
  - totalScore, remark ('Present'|'Late'|'Left Early'|'Absent')
  - faceMatchConfidence
  - gpsDistance (meters from classroom)
```

---

## PHASE 0 — Cleanup Existing Codebase
**Day 1 Morning | Manual steps**

### What to delete
Stop the dev server, then run in PowerShell:

```powershell
# Remove QR-specific files
Remove-Item -Recurse -Force "app/lecturer/sessions" -ErrorAction SilentlyContinue
Remove-Item -Force "lib/firebase/sessions.service.ts" -ErrorAction SilentlyContinue
Remove-Item -Force "lib/firebase/attendance.service.ts" -ErrorAction SilentlyContinue
Remove-Item -Force "lib/utils/qr.utils.ts" -ErrorAction SilentlyContinue

# Create new folders needed
New-Item -ItemType Directory -Force -Path "app/lecturer/sessions"
New-Item -ItemType Directory -Force -Path "app/lecturer/classrooms"
New-Item -ItemType Directory -Force -Path "app/lecturer/reports"
New-Item -ItemType Directory -Force -Path "app/student/enroll"
New-Item -ItemType Directory -Force -Path "app/student/verify"
New-Item -ItemType Directory -Force -Path "lib/api"
New-Item -ItemType Directory -Force -Path "python-backend"
New-Item -ItemType Directory -Force -Path "python-backend/routes"
New-Item -ItemType Directory -Force -Path "python-backend/services"
New-Item -ItemType Directory -Force -Path "python-backend/face_data"
```

### What to KEEP
- `lib/firebase/config.ts` ✅
- `lib/firebase/auth.service.ts` ✅
- `lib/firebase/courses.service.ts` ✅
- `store/auth.store.ts` ✅
- `types/index.ts` (will update) ✅
- `components/layout/` ✅
- `app/login/` ✅
- `app/register/` ✅
- `app/lecturer/dashboard/` ✅
- `app/lecturer/courses/` ✅

### Update types/index.ts
Add new interfaces — paste this prompt into Cursor/Windsurf:

```
Update types/index.ts. Keep existing interfaces and ADD these new ones:

export interface Classroom {
  classroomId: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
}

export interface Session {
  sessionId: string;
  courseId: string;
  courseTitle: string;
  courseCode: string;
  lecturerId: string;
  classroomId: string;
  classroomName: string;
  classroomLat: number;
  classroomLng: number;
  classroomRadius: number;
  status: 'phase1_open' | 'waiting' | 'phase2_open' | 'ended';
  phase1Start: any;
  phase1End: any;
  phase2Start: any;
  phase2End: any;
  phase1Duration: number;
  phase2Duration: number;
  createdAt: any;
}

export interface AttendanceRecord {
  attendanceId: string;
  sessionId: string;
  courseId: string;
  studentId: string;
  studentName: string;
  matricNumber: string;
  phase1Score: number;
  phase1Time: any | null;
  phase1Status: 'present' | 'absent' | 'failed';
  phase2Score: number;
  phase2Time: any | null;
  phase2Status: 'present' | 'absent' | 'failed';
  totalScore: number;
  remark: 'Present' | 'Late' | 'Left Early' | 'Absent';
  faceMatchConfidence: number;
  gpsDistance: number;
}

export interface AttendanceSummary {
  studentId: string;
  studentName: string;
  matricNumber: string;
  totalSessions: number;
  phase1Total: number;
  phase2Total: number;
  totalScore: number;
  maxPossibleScore: number;
  percentage: number;
  remark: string;
}

export interface VerificationResult {
  matched: boolean;
  confidence: number;
  error?: string;
}
```

---

## PHASE 1 — Python Backend Setup
**Day 1 Afternoon | Manual + AI**

### Manual Step: Set up Python backend

```powershell
cd python-backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate

# Install dependencies
pip install fastapi uvicorn python-multipart deepface firebase-admin opencv-python-headless numpy Pillow python-dotenv tf-keras
```

Create `python-backend/requirements.txt`:
```
fastapi
uvicorn
python-multipart
deepface
firebase-admin
opencv-python-headless
numpy
Pillow
python-dotenv
tf-keras
```

Create `python-backend/.env`:
```
FIREBASE_PROJECT_ID=smart-attendance-e8229
FACE_DATA_DIR=./face_data
ALLOWED_ORIGINS=http://localhost:3000,https://your-vercel-app.vercel.app
```

### AI Prompt — Python Backend Core

```
Create a FastAPI backend for a facial recognition attendance system.
Project is in the python-backend/ folder.

=== FILE 1: python-backend/main.py ===
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI(title="Veriface Attendance API", version="1.0.0")

origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from routes import face, health
app.include_router(health.router, prefix="/api")
app.include_router(face.router, prefix="/api/face")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

=== FILE 2: python-backend/routes/health.py ===
from fastapi import APIRouter
router = APIRouter()

@router.get("/health")
def health_check():
    return {"status": "ok", "service": "veriface-attendance-api"}

=== FILE 3: python-backend/services/face_service.py ===
import os
import base64
import numpy as np
from PIL import Image
import io
import json
from deepface import DeepFace

FACE_DATA_DIR = os.getenv("FACE_DATA_DIR", "./face_data")
os.makedirs(FACE_DATA_DIR, exist_ok=True)

def base64_to_image(base64_str: str) -> np.ndarray:
    """Convert base64 string to numpy array image."""
    if "," in base64_str:
        base64_str = base64_str.split(",")[1]
    img_bytes = base64.b64decode(base64_str)
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    return np.array(img)

def enroll_face(user_id: str, base64_image: str) -> dict:
    """
    Enroll a student's face by generating and storing their face embedding.
    Returns success status and any error message.
    """
    try:
        img_array = base64_to_image(base64_image)
        
        # Generate face embedding using DeepFace
        embedding_result = DeepFace.represent(
            img_path=img_array,
            model_name="Facenet",
            enforce_detection=True,
            detector_backend="opencv"
        )
        
        if not embedding_result:
            return {"success": False, "error": "No face detected in image"}
        
        embedding = embedding_result[0]["embedding"]
        
        # Save embedding to file
        face_file = os.path.join(FACE_DATA_DIR, f"{user_id}.json")
        with open(face_file, "w") as f:
            json.dump({"user_id": user_id, "embedding": embedding}, f)
        
        return {"success": True, "message": "Face enrolled successfully"}
        
    except Exception as e:
        error_msg = str(e)
        if "Face could not be detected" in error_msg:
            return {"success": False, "error": "No face detected. Please ensure your face is clearly visible and well-lit."}
        return {"success": False, "error": f"Enrollment failed: {error_msg}"}

def verify_face(user_id: str, base64_image: str) -> dict:
    """
    Verify a student's face against their stored embedding.
    Returns matched status, confidence score.
    """
    try:
        # Check if face is enrolled
        face_file = os.path.join(FACE_DATA_DIR, f"{user_id}.json")
        if not os.path.exists(face_file):
            return {"matched": False, "confidence": 0, "error": "Face not enrolled. Please complete face enrollment first."}
        
        # Load stored embedding
        with open(face_file, "r") as f:
            stored_data = json.load(f)
        stored_embedding = np.array(stored_data["embedding"])
        
        # Generate embedding for verification image
        img_array = base64_to_image(base64_image)
        verification_result = DeepFace.represent(
            img_path=img_array,
            model_name="Facenet",
            enforce_detection=True,
            detector_backend="opencv"
        )
        
        if not verification_result:
            return {"matched": False, "confidence": 0, "error": "No face detected in verification image"}
        
        verify_embedding = np.array(verification_result[0]["embedding"])
        
        # Calculate cosine similarity
        dot_product = np.dot(stored_embedding, verify_embedding)
        norm_stored = np.linalg.norm(stored_embedding)
        norm_verify = np.linalg.norm(verify_embedding)
        cosine_similarity = dot_product / (norm_stored * norm_verify)
        
        # Convert to confidence percentage
        confidence = float((cosine_similarity + 1) / 2 * 100)
        
        # Threshold: 70% confidence for a match
        MATCH_THRESHOLD = 70.0
        matched = confidence >= MATCH_THRESHOLD
        
        return {
            "matched": matched,
            "confidence": round(confidence, 2),
            "threshold": MATCH_THRESHOLD
        }
        
    except Exception as e:
        error_msg = str(e)
        if "Face could not be detected" in error_msg:
            return {"matched": False, "confidence": 0, "error": "No face detected. Ensure face is visible and well-lit."}
        return {"matched": False, "confidence": 0, "error": f"Verification failed: {error_msg}"}

def delete_face(user_id: str) -> dict:
    """Delete stored face data for a user."""
    face_file = os.path.join(FACE_DATA_DIR, f"{user_id}.json")
    if os.path.exists(face_file):
        os.remove(face_file)
        return {"success": True}
    return {"success": False, "error": "No face data found"}

=== FILE 4: python-backend/routes/face.py ===
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

Create python-backend/routes/__init__.py as empty file.
Create python-backend/services/__init__.py as empty file.
```

### Test the backend manually
```powershell
cd python-backend
venv\Scripts\activate
python main.py
```
Open browser: `http://localhost:8000/api/health`
Should return: `{"status": "ok", "service": "veriface-attendance-api"}`

---

## PHASE 2 — Face Enrollment Flow (Frontend)
**Day 2 | AI Prompt**

```
Build the face enrollment flow for the Smart Attendance facial recognition system.
The Python backend runs at http://localhost:8000.
Firebase is already configured. Users are already authenticated.

Create lib/api/face.api.ts:
Functions to call the FastAPI backend:
- enrollFace(userId: string, base64Image: string): Promise<{success: boolean, message?: string, error?: string}>
  POST to /api/face/enroll
- verifyFace(userId: string, base64Image: string): Promise<{matched: boolean, confidence: number, error?: string}>
  POST to /api/face/verify
- checkFaceEnrolled(userId: string): Promise<{enrolled: boolean}>
  GET to /api/face/status/{userId}

Use process.env.NEXT_PUBLIC_API_URL for the base URL.

Add NEXT_PUBLIC_API_URL=http://localhost:8000 to .env.local

Create app/student/enroll/page.tsx — Face Enrollment Screen:
This is a 'use client' mobile-optimized page.

Flow:
1. Page loads → check if face already enrolled via checkFaceEnrolled
2. If enrolled → show "Face already enrolled" with option to re-enroll
3. If not enrolled → show enrollment UI

Enrollment UI layout (mobile-first, max-width 480px centered):
- Header: "Face Enrollment" with back arrow
- Instruction card: 
  Icon (camera), heading "Set up face verification"
  Body: "Take a clear photo of your face. Ensure good lighting and look directly at the camera."
  Note: "Your face data is used only for attendance verification."
- Camera preview area:
  Use getUserMedia API to show live camera feed in a <video> element
  Circular crop overlay (using CSS border-radius and a semi-transparent overlay with a hole)
  The circle guide is 280px diameter, centered
- Below camera:
  "Take Photo" button (full width, green)
  When photo is taken:
    - Show captured image preview in the circle
    - Show "Submitting..." loading state
    - Call enrollFace() with base64 image
    - On success: show success screen with checkmark and "Enrollment Complete"
    - On error: show error message with "Try Again" button

Success screen:
  Large green checkmark, "Face Enrolled Successfully!"
  "Your face is now registered for attendance verification."
  Button "Go to Dashboard" → /student/dashboard

Camera implementation:
  useEffect to initialize camera: navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
  Capture photo using canvas: draw video frame to canvas, convert to base64
  Always use front-facing camera (facingMode: 'user')
  Clean up camera stream on unmount

Error handling:
  Camera permission denied → show message "Camera access required for face enrollment. Please allow camera access in your browser settings."
  No face detected error from API → "No face detected. Please ensure your face is visible and well-lit."

Create app/student/enroll/layout.tsx:
Simple layout with no sidebar — just children directly.
Auth guard: must be logged in as student.

Update app/student/dashboard/page.tsx:
After loading, check if face is enrolled using checkFaceEnrolled.
If NOT enrolled: show a prominent yellow warning banner at the top:
"⚠️ Face verification not set up — You won't be able to mark attendance until you enroll your face."
With a button "Set up now" → /student/enroll

Update components/layout/StudentSidebar.tsx:
Change "Scan QR Code" nav item to:
{ label: 'Verify Attendance', href: '/student/verify', icon: ScanFace }

Styling:
- Mobile-first, max content width 480px
- Camera preview: full width on mobile
- Circular overlay using position absolute
- All Tailwind classes
- Primary color #2D6A4F throughout
```

---

## PHASE 3 — Classroom Management + Session Service
**Day 3 | AI Prompt**

```
Build classroom management and session services for the facial recognition attendance system.

=== FILE 1: lib/firebase/classrooms.service.ts ===
CRUD operations for classrooms:
- createClassroom(data: {name, latitude, longitude, radius}): Promise<Classroom>
- getClassrooms(): Promise<Classroom[]>
- getClassroomById(id: string): Promise<Classroom | null>
- updateClassroom(id: string, data: Partial<Classroom>): Promise<void>
- deleteClassroom(id: string): Promise<void>

=== FILE 2: lib/firebase/sessions.service.ts ===
Session management:

startSession(data: {
  courseId, courseTitle, courseCode, lecturerId,
  classroomId, classroomName, classroomLat, classroomLng, classroomRadius,
  phase1Duration, phase2Duration
}): Promise<Session>
  - Creates session with status: 'phase1_open'
  - Sets phase1Start: now, phase1End: now + phase1Duration minutes
  - Sets phase2Start: phase1End + 5min (waiting period), phase2End: phase2Start + phase2Duration

updateSessionStatus(sessionId: string, status: Session['status']): Promise<void>

endSession(sessionId: string): Promise<void>
  - Sets status: 'ended', phase2End: now if not set

getActiveSessionForCourse(courseId: string): Promise<Session | null>
  - Query where courseId == courseId AND status != 'ended'

getSessionById(sessionId: string): Promise<Session | null>

getSessionsForCourse(courseId: string): Promise<Session[]>
  - Order by createdAt desc

subscribeToSession(sessionId: string, callback): () => void
  - onSnapshot listener

=== FILE 3: lib/firebase/attendance.service.ts ===

recordPhase1Attendance(data: {
  sessionId, courseId, studentId, studentName, matricNumber,
  phase1Score, faceMatchConfidence, gpsDistance
}): Promise<AttendanceRecord>
  - Check no existing phase1 record for this student+session
  - Create attendance doc with phase1 data
  - phase1Status: 'present' if score > 0, 'failed' otherwise

recordPhase2Attendance(sessionId: string, studentId: string, data: {
  phase2Score, faceMatchConfidence, gpsDistance
}): Promise<void>
  - Find existing attendance doc for student+session
  - Update phase2 fields
  - Calculate totalScore and remark:
    Both phases present → 'Present'
    Only phase1 → 'Left Early'  
    Only phase2 → 'Late'
    Neither → 'Absent'

getSessionAttendance(sessionId: string): Promise<AttendanceRecord[]>

subscribeToSessionAttendance(sessionId: string, callback): () => void
  - onSnapshot for real-time updates

=== FILE 4: app/lecturer/classrooms/page.tsx ===
Classroom management page:
- List of classrooms with name, coordinates, radius
- "Add Classroom" button → modal form:
  Name (e.g. "Lecture Hall 1")
  Latitude input
  Longitude input  
  Allowed radius in meters (default 100)
  "Get Current Location" button → fills lat/lng using navigator.geolocation
- Edit and delete options per classroom

=== FILE 5: Update LecturerSidebar ===
Add Classrooms nav item:
{ label: 'Classrooms', href: '/lecturer/classrooms', icon: MapPin }
```

---

## PHASE 4 — Session Start + Live Monitor
**Day 4 | AI Prompt**

```
Build the session start flow and live session monitor for the lecturer.

=== FILE 1: app/lecturer/sessions/start/page.tsx ===
Session start page — lecturer starts a new attendance session.

Layout (mobile-optimized):
1. Page header "Start Attendance Session"
2. Course selector — dropdown of lecturer's courses
3. After course selected, show course details card (title, code, phase durations)
4. Classroom selector — list of classroom cards to tap/select
5. Session settings (read from course, but editable):
   Phase 1 duration (minutes)
   Phase 2 duration (minutes)  
6. "Start Session" button → calls startSession, navigates to /lecturer/sessions/[sessionId]

=== FILE 2: app/lecturer/sessions/[sessionId]/page.tsx ===
Live session monitor — the most important lecturer screen.

Layout:
Top section:
  - Course name + code
  - Status banner (changes color by phase):
    Phase 1 open → green "Phase 1 Open — Check In"
    Waiting → amber "Waiting Period — Phase 2 opens in X:XX"
    Phase 2 open → blue "Phase 2 Open — Check Out"  
    Ended → gray "Session Ended"
  - Large countdown timer (MM:SS) showing time remaining in current phase
  
Stats row:
  - Phase 1: X checked in
  - Phase 2: X checked out
  - Total enrolled: X

Live attendance list:
  - Real-time updating list of students who have verified
  - Each row: name, matric no, phase1 status, phase2 status, confidence score
  - Color coded: green = verified, red = failed, gray = not yet

Bottom:
  - "End Session" button (red, confirm dialog)

Phase timer logic:
  - Subscribe to session via subscribeToSession
  - Calculate time remaining based on phase1End, phase2Start, phase2End
  - Auto-update status display
  - Show transition message when phase changes

=== FILE 3: Update app/lecturer/courses/[courseId]/page.tsx ===
Add "Start Attendance Session" button that navigates to /lecturer/sessions/start?courseId=[courseId]
Show recent sessions list for this course.
```

---

## PHASE 5 — Student Verification Flow (Core Feature)
**Day 5-6 | AI Prompt**

```
Build the student attendance verification flow. This is the most critical feature.

=== FILE 1: lib/utils/gps.utils.ts ===

getCurrentPosition(): Promise<{latitude: number, longitude: number}>
  - Wraps navigator.geolocation.getCurrentPosition in a Promise
  - Timeout: 10 seconds
  - High accuracy: true
  - Error messages: 
    Permission denied → "Location access denied. Enable location in browser settings."
    Timeout → "Location request timed out. Please try again."
    Unavailable → "Location unavailable. Please check your device GPS."

calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number
  - Haversine formula
  - Returns distance in meters

isWithinRadius(studentLat: number, studentLng: number, 
               classroomLat: number, classroomLng: number, 
               radiusMeters: number): boolean
  - Returns true if student is within allowed radius

=== FILE 2: app/student/verify/page.tsx ===
Student verification page — used for BOTH Phase 1 and Phase 2.

On load:
1. Get courseId from URL params (?courseId=xxx)
2. Fetch active session for the course
3. Determine which phase is open (check session.status)
4. If no active session → show "No active session for this course"
5. If session ended → show "Session has ended"

Verification flow UI (mobile-optimized):

STEP 1 — GPS Check (shown first):
  Screen shows:
    Course name + phase indicator ("Phase 1 — Check In" or "Phase 2 — Check Out")
    Location icon animation (pulsing)
    "Getting your location..." text
    Auto-runs getCurrentPosition() on load
  
  If location obtained:
    Calculate distance from classroom
    If within radius → green "Location confirmed (Xm from classroom)" → auto-advance to Step 2
    If outside radius → red "You are Xm away from the classroom (max Ym allowed)"
      Show "Try Again" button
      Do NOT allow proceeding — GPS must pass
  
  If location denied → show error with instructions to enable GPS

STEP 2 — Face Capture:
  Screen shows:
    "Now verify your identity"
    Live camera preview (front camera, full width)
    Circular face guide overlay (same as enrollment)
    "Capture & Verify" button
  
  On capture:
    Show processing overlay: "Verifying your face..."
    Call verifyFace(userId, base64Image)
    
    If matched (confidence >= 70%):
      → Show success animation
      → Call recordPhase1Attendance or recordPhase2Attendance based on current phase
      → Show "Attendance Recorded" result screen
    
    If not matched (confidence < 70%):
      → Show "Face verification failed (XX% match, 70% required)"
      → Show "Try Again" — allows 3 attempts maximum
      → After 3 failures: "Maximum attempts reached. Contact your lecturer."
      → Log the failed attempt still (with failed status, 0 score)
    
    If no face detected:
      → "No face detected. Ensure good lighting and face is visible."
      → Does NOT count as an attempt

STEP 3 — Result Screen:
  Success:
    Large green checkmark
    "Phase X Attendance Recorded!"
    Score awarded (e.g. "+3 marks")
    Face match confidence shown (e.g. "99.2% match")
    "Back to Dashboard" button
  
  Failed (after max attempts):
    Red X icon
    "Verification Failed"
    "Your attendance could not be verified for this session."
    "Back to Dashboard" button

=== FILE 3: Update app/student/courses/page.tsx ===
Each enrolled course card should show:
  - Course name + code
  - If active session exists: green "Live" badge + "Verify Attendance" button
    → navigates to /student/verify?courseId=[courseId]
  - If no active session: "No active session"
  - Student's current attendance percentage for the course

=== FILE 4: Update app/student/dashboard/page.tsx ===
Add "Active Sessions" section:
  - Check all enrolled courses for active sessions
  - If any active: show prominent card "Attendance session is live for [Course]"
  - Large "Verify Now" button → /student/verify?courseId=[courseId]
```

---

## PHASE 6 — Reports + History
**Day 7 | AI Prompt**

```
Build attendance reports and history screens.

=== FILE 1: app/lecturer/reports/[courseId]/page.tsx ===
Course attendance report:

Layout:
  Course header (title, code, lecturer)
  
  Session selector: horizontal scroll of session date chips
  Most recent selected by default
  
  For selected session:
  - Summary row: Total Enrolled | Phase 1 Present | Phase 2 Present | Absent
  - Attendance table (scrollable):
    # | Name | Matric | Phase 1 | Phase 2 | Total | Remark
    Color coded rows: green=Present, amber=Late/Left Early, red=Absent
  
  Export buttons: "Export CSV" | "Export PDF"

=== FILE 2: app/lecturer/reports/[courseId]/semester/page.tsx ===
Semester cumulative report:
  All sessions summed per student
  Columns: Name | Matric | Total Score | Max Possible | Percentage | Remark
  Export CSV + PDF

=== FILE 3: app/student/history/page.tsx ===
Student attendance history:
  Per-course breakdown:
    Course name + code
    Phase 1 total / Phase 2 total / Overall %
    Session-by-session history (expandable)
    Remark tag per session

=== FILE 4: lib/export/csv.service.ts ===
exportSessionCSV(courseTitle, sessionDate, records): void
  Build CSV, trigger download

=== FILE 5: lib/export/pdf.service.ts ===
exportSessionPDF(courseTitle, lecturerName, sessionDate, records): void
  Use jsPDF + autotable
  Professional header, colored rows by remark
```

---

## PHASE 7 — Profile + Polish
**Day 8-9 | AI Prompt**

```
Build profile pages and polish all mobile UI.

=== FILE 1: app/lecturer/profile/page.tsx ===
Lecturer profile:
  Avatar circle (initials)
  Editable: name, department
  Read-only: email, role
  "Update Profile" button
  "Change Password" → Firebase sendPasswordResetEmail
  "Sign Out" button (red)

=== FILE 2: app/student/profile/page.tsx ===
Student profile:
  Avatar circle (initials)
  Editable: name, matric number, department, level
  Read-only: email, role
  Face enrollment status badge (enrolled/not enrolled)
  "Re-enroll Face" button → /student/enroll
  "Update Profile" button
  "Sign Out" button (red)

=== MOBILE POLISH TASKS ===
For every page, ensure:
  1. Max content width 480px, centered on larger screens
  2. All buttons minimum 48px height (touch target)
  3. Input fields minimum 48px height
  4. Bottom padding 80px on scrollable pages (avoids content behind mobile browser UI)
  5. Font sizes: headings 20-24px, body 15-16px, labels 13-14px
  6. No hover-only interactions — everything works on touch
  7. Loading states on every async action
  8. Error messages are user-friendly (no raw Firebase/API errors)

=== UPDATE REGISTER PAGE ===
Add department dropdown with options:
  Computer Science, Software Engineering, Cyber Security,
  Information Technology, Computer Engineering, Electrical Engineering,
  Mechanical Engineering, Civil Engineering, Business Administration, Other

=== ADD COURSE FIELDS ===
Update app/lecturer/courses/page.tsx create course form to include:
  - Level (dropdown: 100, 200, 300, 400, 500)
  - Unit (number input)
  - Phase 1 Duration (minutes, default 15)
  - Phase 2 Duration (minutes, default 15)
  - Phase 1 Marks (number, default 3)
  - Phase 2 Marks (number, default 2)
Update createCourse in courses.service.ts to save these fields.
Update Course type to include: level, unit, phase1Duration, phase2Duration, phase1Marks, phase2Marks
```

---

## PHASE 8 — Deployment
**Day 12-13 | Manual Steps**

### Deploy Python Backend to Railway

1. Create account at railway.app
2. New Project → Deploy from GitHub repo
3. Or use Railway CLI:
```bash
npm install -g @railway/cli
railway login
cd python-backend
railway init
railway up
```
4. Add environment variables in Railway dashboard:
   - `FACE_DATA_DIR=/app/face_data`
   - `ALLOWED_ORIGINS=https://your-vercel-app.vercel.app`
5. Copy the Railway URL (e.g. `https://your-app.railway.app`)

### Update Frontend for Production
In `.env.local`:
```
NEXT_PUBLIC_API_URL=https://your-app.railway.app
```

In Vercel dashboard, add environment variable:
```
NEXT_PUBLIC_API_URL=https://your-app.railway.app
```

### Deploy Frontend to Vercel
```bash
npm install -g vercel
vercel
```
Follow prompts, add all NEXT_PUBLIC_FIREBASE_* environment variables.

### Test on Phone
1. Open Vercel URL on phone
2. Register as lecturer → create course + classroom
3. Register as student (incognito/different browser) → enroll face
4. Lecturer starts session
5. Student verifies attendance
6. Lecturer sees real-time update

---

## Summary Table

| Phase | What | Days |
|-------|------|------|
| 0 | Cleanup + types update | Day 1 AM |
| 1 | Python FastAPI backend + DeepFace | Day 1 PM |
| 2 | Face enrollment frontend | Day 2 |
| 3 | Classrooms + session services | Day 3 |
| 4 | Session start + live monitor | Day 4 |
| 5 | Student verification flow | Day 5-6 |
| 6 | Reports + history | Day 7 |
| 7 | Profile + mobile polish | Day 8-9 |
| 8 | Deploy Railway + Vercel | Day 12-13 |
| Buffer | Testing + bug fixes | Day 10-11, 14 |

---

## Key Technical Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Face recognition library | DeepFace (Facenet model) | Best accuracy, easiest Python setup |
| Face storage | JSON files on Railway | Simple, no extra DB needed for v1 |
| GPS verification | Browser Geolocation API | Works on mobile Chrome/Safari |
| Session phases | Timer-based, auto-transition | Realistic demo, less manual control needed |
| Match threshold | 70% cosine similarity | Balance between security and usability |
| Camera | Front-facing only | Attendance use case |

---

## Demo Script (For Your Defense)

1. "The lecturer logs in and creates a course with two attendance phases"
2. "The lecturer sets up a classroom with GPS coordinates"
3. "Students register and enroll their face — stored as a secure mathematical encoding, not a photo"
4. "The lecturer starts a session — Phase 1 opens for 15 minutes"
5. "The student opens the app, gets their location verified, then captures their face"
6. "The system matches against the stored encoding with 99% confidence"
7. "The lecturer sees the student appear in real-time on the session monitor"
8. "After the waiting period, Phase 2 opens for check-out"
9. "The final report shows each student's Phase 1, Phase 2, total score and remark"
10. "The lecturer exports the report as PDF"
