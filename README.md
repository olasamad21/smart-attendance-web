# EduVerify — Smart Attendance

EduVerify replaces paper sign-in sheets with attendance that verifies **who** is checking in and
**where** they are. Students check in from their phone with a face scan inside the classroom;
lecturers watch check-ins arrive live and export reports.

## How it works

Each class session has two windows:

1. **Check-in (Phase 1)** at the start of class.
2. **Check-out (Phase 2)** near the end, so students who leave early don't get full marks.

To check in, a student:

1. Opens the live session on their phone.
2. Passes a **location check**: the phone collects GPS readings for a few seconds and keeps the
   most accurate one, which must fall within the classroom's radius.
3. Passes a **face check with liveness**: blink, then turn their head to a randomly chosen side,
   so a printed photo or pre-recorded video doesn't work.
4. The server verifies everything again and records the attendance.

Lecturers see each check-in appear in real time, can check a student in manually (with a
reason), and can export CSV or PDF reports per session or per semester.

## Features

**Students**
- Guided face enrollment: blink once, then four photos captured automatically
  (straight, left, right, straight), with live hints for lighting, distance and angle.
- Live session alerts with countdowns on the dashboard.
- Attendance history and an overall attendance percentage per course.

**Lecturers**
- Courses with enrollment keys and configurable marks per phase.
- Classrooms placed by averaging about 12 seconds of GPS readings, with a suggested radius.
- Live session view: who's in, who's missing, manual overrides, early check-out, and ending the
  session with marks.
- Location review flags for suspicious GPS: impossible travel, signs of fake-location apps.
- Statistics, plus CSV and PDF exports.

**Installable app**
- Add EduVerify to the home screen (Android, iPhone, desktop Chrome/Edge): full-screen, app
  icon, and a branded offline page when there's no connection.

## Security model

- **The server decides attendance.** The browser only submits evidence (an aligned face crop
  and a GPS reading). The Python API checks the session window, enrollment, distance and face
  match, then writes the record. Firestore security rules stop students from writing
  attendance themselves.
- **Authenticated API.** Every request carries a Firebase ID token, and the user's identity
  comes from that token, never from the request body.
- **Biometric data stays server-side.** Only face embeddings are stored (no photos), in a
  Firestore collection that clients cannot read.
- **Least-privilege rules.** Students read only their own data; lecturers manage only their own
  courses. The rules are covered by 51 emulator tests.

## Architecture

```
Phone / browser (Next.js 16, React 19, Tailwind 4)
  ├─ MediaPipe Face Landmarker ── quality checks, liveness, aligned face crop
  ├─ Firebase Auth + Firestore ── profiles, courses, sessions, live updates (read-only for students)
  └─ /backend/* ──(Next.js proxy)──> Python API (FastAPI)
                                        ├─ RetinaFace detection + Facenet512 embeddings (DeepFace)
                                        ├─ Firebase Admin SDK: token checks, attendance writes
                                        └─ face_embeddings (server-only Firestore collection)
```

## Running locally

Requirements: Node.js 20+, Python 3.11, a Firebase project (Auth + Firestore), and
[cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
for phone demos.

1. **Frontend:** `npm install`, then create `.env.local` with your Firebase web config:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   NEXT_PUBLIC_FIREBASE_APP_ID=...
   NEXT_PUBLIC_API_URL=/backend
   ```
2. **Backend:** in `python-backend/`, create a virtualenv in `venv/` and install
   `requirements.txt`. Then create `python-backend/.env`:
   ```
   FIREBASE_SERVICE_ACCOUNT_PATH=C:/path/to/service-account.json   # keep outside the repo
   MATCH_THRESHOLD=0.70
   ```
3. **Security rules:** deploy them with `firebase deploy --only firestore:rules`.
4. **Demo:** run `npm run demo`. This starts the API, builds and starts the site, and opens a
   Cloudflare tunnel. It prints an HTTPS link that works on any phone, where camera and GPS
   need HTTPS. Use `npm run demo -- -Force` if an earlier demo is still running.

## Project structure

```
app/                 Next.js routes (student/, lecturer/, auth pages)
components/          Layout, map, face camera and UI components
hooks/               useFaceTracker (camera + MediaPipe), useLivenessCheck
lib/face/            Face quality analysis and aligned cropping
lib/firebase/        Firestore services
lib/utils/           GPS sampling and proximity, session phases, CSV/PDF export
python-backend/      FastAPI app: routes/, services/ (face, attendance, firebase), scripts/
firestore.rules      Security rules
scripts/demo.ps1     One-command local demo
ROADMAP.md           Improvement plan and progress
```

## Tuning face matching

`python -m scripts.face_calibration` (in `python-backend/`) reports similarity scores between
photos of the same person and of different people, and suggests a `MATCH_THRESHOLD`. Run it once
at least five people have enrolled.
