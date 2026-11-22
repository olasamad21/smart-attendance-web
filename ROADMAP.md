# EduVerify — Improvement Roadmap

Goal: turn EduVerify into a premium, trustworthy attendance product that students and lecturers want to use.
Principle: **trust first, then polish.** Polish doesn't matter if attendance can be faked.

Status legend: ☐ not started · ◐ in progress · ☑ done

---

## Phase 1 — Trust & Security (foundation)

Attendance must be decided and written by the server, never by the student's browser.

| # | Item | Where | Status |
|---|------|-------|--------|
| 1.1 | **Server-side attendance writes.** The backend (FastAPI + Firebase Admin SDK) verifies face + GPS + session window, then writes the attendance doc. Client becomes read-only for `attendance`. | `python-backend/`, `lib/firebase/attendance.service.ts`, `app/student/verify/page.tsx` | ☑ |
| 1.2 | **Deterministic attendance IDs** (`${sessionId}_${studentId}`) inside a transaction — no duplicate records on double-tap. | backend + `attendance.service.ts` | ☑ |
| 1.3 | **Real Firestore rules** for `users`, `courses`, `enrollments`, `sessions`, `classrooms`, `attendance` (students: own data only; lecturers: own courses only; `attendance` writes server-only except lecturer overrides). | `firestore.rules` | ☑ |
| 1.4 | **Authenticated face API.** Every request carries a Firebase ID token; the backend verifies it and derives `user_id` from the token (no more trusting `user_id` in the body/URL). | `python-backend/routes/face.py`, `lib/api/face.api.ts` | ☑ |
| 1.5 | **Persistent biometric storage.** Move embeddings off the container disk (wiped on redeploy) into Firestore (server-only collection) or Cloud Storage. | `face_service.py` | ☑ |
| 1.6 | **Purge face data from git.** Add `face_data/` to `.gitignore`, remove files, rewrite history if the repo was ever shared. | repo | ◐ untracked + ignored; history rewrite pending |

### Phase 1 — what changed

- **Backend** (`python-backend/`): `services/firebase.py` (Admin SDK + `require_uid` token check), `services/attendance_service.py` + `routes/attendance.py` (`POST /api/attendance/mark`), face routes now token-based (`/api/face/enroll`, `GET /api/face/status`, `DELETE /api/face/me`; the unauthenticated `/verify` endpoint is removed). Embeddings live in `face_embeddings/{uid}`; legacy `face_data/*.json` files are migrated on first access, then deleted.
- **Server rules for marking:** session phase from timestamps (+45 s grace), enrollment, GPS distance computed server-side, max 3 face mismatches per phase, marks from the course settings, one record per student per session (`{sessionId}_{studentId}`) written in a transaction.
- **Frontend:** verify page calls the backend instead of writing Firestore; students no longer write to `sessions`; manual overrides use deterministic ids in a transaction; matric uniqueness uses create-only `matricNumbers/{id}` claim docs.
- **Rules:** `firestore.rules` rewritten; 51 emulator tests pass (students cannot create/edit attendance or sessions, lecturers limited to their own courses, server-only collections closed).

### Phase 1 — deployment checklist (order matters)

Hosting: **local demo on the laptop** (`npm run demo`) — Next.js + Python API on the laptop, exposed through a Cloudflare quick tunnel (public HTTPS link, works on phones). Cloud hosting deferred (Railway trial ended, Hugging Face Docker is paid, Google Cloud billing inactive). Cloud Run config (`python-backend/.gcloudignore`, Dockerfile) is ready if that changes.

1. ☑ Firebase service-account key (local only, outside the repo).
2. ☑ Matric-number claims backfilled.
3. ☑ Backend proxied through Next.js at `/backend` — one HTTPS origin for phones.
4. ☑ `npm run demo` launcher; phone check-in tested end to end.
5. ☑ Firestore rules deployed (2026-11-22). Previous fully-open rules replaced; anonymous reads now return 403.

### Known limitations (follow-ups)

- Anyone can register as a **lecturer** (role is chosen at sign-up) → lecturer approval / invite codes.
- Course docs (including enrollment keys) are readable by any signed-in user → move "join course" to the backend.
- Face data was committed in git history → rewrite history if the repo was ever shared.

## Phase 2 — Face Recognition Accuracy & Liveness

| # | Item | Where | Status |
|---|------|-------|--------|
| 2.1 | **Browser-side face quality gate (MediaPipe Face Landmarker).** Checks face present, centred, large enough, frontal, sharp and well lit; auto-captures when good. Sends a **tightly cropped, aligned face** — this fixes the detection failures that led to `DETECTOR = "skip"`. | `app/student/verify`, `app/student/enroll` | ☑ |
| 2.2 | **Enable server detection/alignment** (RetinaFace, MTCNN fallback) on the pre-cropped face for consistent embeddings. | `face_service.py` | ☑ |
| 2.3 | **Real liveness.** MediaPipe eye-aspect-ratio blink + random head-turn challenge in the browser; optional server anti-spoof model (e.g. DeepFace `anti_spoofing=True`) to reject photos and screens. Replace the current non-functional blink heuristic. | verify page, backend | ◐ blink + random head-turn done; server anti-spoof model deferred (needs PyTorch) |
| 2.4 | **Guided multi-pose enrollment** (3–5 shots: front, left, right, different lighting). Store each embedding; match against the **best** sample instead of an averaged embedding. | enroll page, `face_service.py` | ☑ |
| 2.5 | **Calibrated threshold.** Measure genuine vs impostor scores on real users, pick the threshold from data; backend is the single source of truth (UI currently says 70%, server uses 65%). | backend, verify page | ◐ default 0.70 + `scripts/face_calibration.py`; recalibrate after ≥5 real users |
| 2.6 | **Adaptive templates.** After a high-confidence match, store that embedding as an extra sample (capped) to keep up with haircuts, glasses, ageing. | `face_service.py` | ☑ |
| 2.7 | **Smaller payload.** Send a ~320–480px cropped JPEG at ~0.85 quality; show "Uploading → Matching" progress. | verify page | ☑ |

## Phase 3 — GPS Accuracy & Anti-Spoofing

| # | Item | Where | Status |
|---|------|-------|--------|
| 3.1 | **Best-fix sampling.** Use `watchPosition` for a few seconds, keep the most accurate reading; live "Improving accuracy… ±35m" UI. | `lib/utils/gps.utils.ts`, verify page | ☐ |
| 3.2 | **Accuracy-aware check.** Pass if `distance − accuracy ≤ radius`; reject fixes worse than ~±100m with guidance ("move near a window") instead of silent pass/fail. | `gps.utils.ts` | ☐ |
| 3.3 | **Lecturer "Set from my location".** Average several readings while standing in the room to place the pin; suggest a radius from the observed accuracy. | `app/lecturer/classrooms`, `ClassroomMap.tsx` | ☐ |
| 3.4 | **Server-side distance validation** as part of the Phase 1.1 attendance write. | backend | ☑ |
| 3.5 | **Suspicious-location flags** (accuracy = 0 / perfectly round values, impossible travel between sessions) shown to the lecturer for review — flag, don't hard-block. | backend, live session page | ☐ |

## Phase 4 — Bug Fixes

| # | Item | Where | Status |
|---|------|-------|--------|
| 4.1 | "Overall Attendance" is hardcoded to `0%` — compute it. | `app/student/dashboard/page.tsx` | ☐ |
| 4.2 | Manual override hardcodes 3/2 marks; "End & award marks" hardcodes 2 — use the course's `phase1Marks` / `phase2Marks`. | `app/lecturer/sessions/[sessionId]/page.tsx` | ☐ |
| 4.3 | Home page `/` is an off-brand spinner with hardcoded colours. | `app/page.tsx` | ☐ |
| 4.4 | One brand name everywhere (EduVerify vs Veriface vs Kinetic Clarity); replace boilerplate README. | app-wide, `README.md`, `DESIGN_SYSTEM.md` | ☐ |
| 4.6 | **Export buttons are broken:** reports and live-session pages import `generateSessionCSV`, `generateSessionPDF`, `generateSemesterCSV/PDF`, `calculateGpsDistance` which don't exist, and call `downloadCSV`/`downloadPDF` without importing them. | `app/lecturer/courses/[courseId]/reports/page.tsx`, `app/lecturer/sessions/[sessionId]/page.tsx` | ☐ |
| 4.7 | Builds ignore TypeScript and ESLint errors (`next.config.ts`), which is how 4.6 shipped — fix errors, then turn checking back on. | `next.config.ts` | ☐ |
| 4.5 | Silent `catch` blocks — surface errors to the user. | app-wide | ☐ |

## Phase 5 — Performance & Cost

| # | Item | Where | Status |
|---|------|-------|--------|
| 5.1 | Active-session listeners read the **entire session history** per course on every change — query `status in [...]` + `limit(1)`. | `sessions.service.ts` | ☐ |
| 5.2 | Student dashboard re-renders every second — isolate the ticking countdown into its own component. | student dashboard | ☐ |
| 5.3 | Live session page writes phase sync every second and refetches enrolled students on every snapshot — sync only at phase boundaries, fetch students once. | `app/lecturer/sessions/[sessionId]/page.tsx` | ☐ |
| 5.4 | N+1 course fetches in `getStudentCourses` — batch with `where(documentId(), 'in', ...)`. | `courses.service.ts` | ☐ |
| 5.5 | Remove unused deps (`recharts`, `html5-qrcode`, `qrcode.react`, `papaparse`); load Inter once via `next/font`; subset icon font or switch fully to `lucide-react`. | `package.json`, `app/layout.tsx`, `globals.css` | ☐ |

## Phase 6 — Premium UI/UX

**Foundation**
- ☐ Shared component kit: Button, Card, Badge, StatTile, Sheet/Dialog, Toast, Skeleton, ProgressRing.
- ☐ Skeleton loaders instead of spinners; toast notifications for success/error.
- ☐ Motion: step transitions in verify flow, success animation + haptics.
- ☐ Theme follows system by default, toggle reachable everywhere.
- ☐ Responsive desktop layouts for lecturers (tables, split panes).

**Key screen redesigns**
- ☐ Landing page at `/` (what it is, how it works, student/lecturer entry).
- ☐ Student dashboard: hero "Mark attendance" with countdown ring, per-course attendance %, threshold warnings.
- ☐ Verify flow: stepper (Location → Face → Done), map + distance feedback on failure, guided camera overlay.
- ☐ Lecturer live session: projector-friendly countdown, real-time check-in feed, present/enrolled ring.

**Student extras**
- ☐ Per-course attendance %, streaks, "you need X% to sit exams" warnings.
- ☐ Clear, actionable failure messages.

**Lecturer extras**
- ☐ One-tap "repeat last session".
- ☐ At-risk students list, weekly summaries, semester exports.
- ☐ Audit log of manual overrides.

## Phase 7 — Engagement & Platform

- ☐ PWA: installable, offline shell, fast start.
- ☐ Push notifications (FCM): "CSC 301 attendance is open — 8 min left".
- ☐ Email/notification digests for lecturers.

---

## Execution order

1. **Phase 1** (security) — the server-side write endpoint is built together with **2.2–2.5** and **3.4**, since they all live in the same verification request.
2. **Phase 2 + 3** client-side work (MediaPipe capture, GPS sampling, enrollment, classroom calibration).
3. **Phase 4 + 5** — quick bug and performance wins.
4. **Phase 6** — component kit first, then the four key screens.
5. **Phase 7** — engagement features.

Each phase ships as its own commit set and is tested on a real phone before moving on.
