# Smart Attendance Web - Actions & Decisions Log

## 1. UI & Frontend Logic Refinements
We started by refining the Lecturer dashboard and session flow to improve user experience and prevent accidental disruptions during live classes.

* **Dashboard Header Adjustment:**
  * **Action:** Removed the hardcoded subtitle "Here is your verification overview for today" from pp/lecturer/dashboard/page.tsx.
  * **Decision:** The text was unnecessary clutter for the lecturer's main view, so it was removed to keep the interface clean and focused strictly on the greeting and core metrics.

* **Live Session "Fast-Forward" Button Logic:**
  * **Action:** Modified pp/lecturer/sessions/[sessionId]/page.tsx to conditionally render the "Start Phase 2 Now" (fast-forward) button.
  * **Decision:** Previously, it was always visible. We restricted it so it ONLY appears when the session status is ctive AND the current phase is waiting. This prevents lecturers from accidentally fast-forwarding while Phase 1 is still ongoing.

* **Course Details - Active Session Detection:**
  * **Action:** Updated pp/lecturer/courses/[courseId]/page.tsx to actively check for an ongoing session using getActiveSessionWithSync.
  * **Decision:** If a session is live, the page now replaces the "Start Attendance Session" button with a "Return to Live Session" button. 
  * **Decision:** We also explicitly disabled the "Settings" button and completely hid the "Delete" button while a session is live to ensure the lecturer cannot accidentally delete or mutate the course while students are actively signing in.

* **Session Timing & Total Duration Math:**
  * **Action:** Added a "Total Class Duration" selector to pp/lecturer/sessions/start/page.tsx.
  * **Action:** Updated startSession in lib/firebase/sessions.service.ts to calculate the start time of Phase 2 using the formula: Total Duration - Phase 2 Duration.
  * **Decision:** Previously, Phase 2 started a hardcoded 5 minutes after Phase 1. By introducing Total Duration, the "waiting period" is now dynamically and mathematically accurate, allowing for fully customizable class schedules. Validation was added to ensure Phase 1 + Phase 2 cannot exceed the Total Duration.

## 2. Frontend Error Handling (Infinite Spinner Fix)
During testing, the student enrollment page spun infinitely for 30+ minutes because the backend was unreachable.

* **Action:** Wrapped all API calls in lib/api/face.api.ts (enrollFace, erifyFace, etc.) with 	ry/catch blocks.
* **Decision:** The native etch API throws an unhandled Promise Rejection on CORS errors or complete network failures (like a crashed backend). By catching this, the frontend now gracefully fails and displays an actual error message ("Network error: failed to fetch") instead of leaving the user stuck on a loading screen.

## 3. Python Backend Deployment (Railway)
The core objective was to deploy the FastAPI/DeepFace backend to Railway so the live Vercel frontend could communicate with it.

* **Action:** Generated equirements.txt via pip freeze in the python-backend directory.
* **Action:** Created a Procfile in python-backend with the command web: uvicorn main:app --host 0.0.0.0 --port $PORT.
  * **Decision:** Railway injects its own internal port routing via the $PORT environment variable. The Procfile ensures Uvicorn binds to the correct dynamic port rather than hardcoding 8000.

* **Railway Configuration Setup:**
  * Set the **Root Directory** in Railway to /python-backend so it wouldn't try to build the Next.js frontend.
  * Created a **Persistent Volume** and mounted it to /data within Railway.
  * Added the Environment Variable FACE_DATA_DIR=/data so that student face enrollments survive server restarts (Railway has an ephemeral filesystem by default).
  * Generated a Railway Public Domain and added ALLOWED_ORIGINS to match the Vercel frontend URL to bypass CORS blocks.

## 4. The OpenCV "libGL.so.1" Crash & Overrides
The primary blocker we faced during deployment was Railway crashing immediately on boot with: ImportError: libGL.so.1: cannot open shared object file: No such file or directory.

* **The Cause:** The deepface AI library has a hard dependency on opencv-python, which requires native Linux GUI graphics libraries (libgl1). Railway's barebones server environment does not have these GUI libraries installed.
* **Attempt 1 (Nixpacks):** Created a 
ixpacks.toml file with ptPkgs = ["libgl1", "libglib2.0-0"] to instruct Railway's builder to install the missing system packages.
* **Attempt 2 (Root Nixpacks):** Moved the 
ixpacks.toml to the absolute root of the repository, as Railway sometimes ignores sub-directory nixpack configs.
* **Attempt 3 (Headless Enforcement):** Stripped all traces of GUI OpenCV from equirements.txt and explicitly enforced opencv-python-headless==4.9.0.80 (a version built specifically for servers without displays).
* **Attempt 4 (The Procfile Nuke):** Because installing deepface inherently forces opencv-python to reinstall (overriding our headless version), we modified the Procfile to physically rip it out right before the server starts:
  web: pip uninstall -y opencv-python opencv-contrib-python && uvicorn main:app --host 0.0.0.0 --port $PORT

## Next Steps / Current Status
Despite the extreme overrides, the deployment is still failing to spin up properly on Railway. 
Moving forward, we will need to either:
1. Find a way to completely bypass DeepFace's setup.py requirements to prevent it from pulling the GUI version of OpenCV.
2. Rely entirely on Railway's NIXPACKS_APT_PKGS environment variable from the dashboard to force the installation of libgl1-mesa-glx at the OS level.
3. Switch the deployment platform to a Docker container (writing a custom Dockerfile where we have 100% control over  pt-get install libgl1). Docker is the definitive, guaranteed fix for this specific OpenCV error.

## 5. Docker Backend Deployment & OpenCV Resolution (Today's Fixes)
We pivoted to a Docker-based deployment strategy to gain full control over the Linux environment and definitively resolve the OpenCV `libGL.so.1` and `CascadeClassifier` crashes.

* **Action:** Created `python-backend/Dockerfile` using `python:3.11-slim`.
* **Decision:** We used `apt-get install` to install native system libraries (`libgl1`, `libglib2.0-0`, etc.) before Python packages. This guaranteed the OS had the required graphics bindings.
* **Action:** Re-ordered `pip install` commands in the Dockerfile.
* **Decision:** We installed `requirements.txt` (which pulls `deepface` and the broken GUI `opencv-python`) first, then explicitly uninstalled it and installed `opencv-python-headless>=4.10.0`. This successfully prevented DeepFace from overriding the headless server-safe version.
* **Action:** Bumped OpenCV headless to `>=4.10.0`.
* **Decision:** Solved a critical runtime crash (`AttributeError: _ARRAY_API not found`). The old pinned version (`4.9.0.80`) was compiled against NumPy 1.x, but TensorFlow/DeepFace in our requirements pulled NumPy 2.x, causing an ABI mismatch. Upgrading OpenCV resolved this.
* **Action:** Modified `face_service.py` to use `DETECTOR = "skip"` instead of `"opencv"`.
* **Decision:** Fixed the `cv2.CascadeClassifier` crash. Since our frontend already forces the user to center their face within an oval, we don't need DeepFace to redundantly detect the face bounding box on the backend. This bypassed the broken OpenCV classifier dependency entirely.

## 6. Frontend UX & Liveness Detection Overhaul
Redesigned the student camera interfaces to be more premium, robust, and secure.

* **Animated Multi-Capture Enrollment:**
  * **Action:** Rebuilt `app/student/enroll/page.tsx`. Replaced the manual capture button with an automated "Begin Scan" flow.
  * **Decision:** The UI now displays an animated SVG arc that sweeps around the face oval. During this 4-second sweep, it silently captures 4 images and sends them sequentially to the backend, which averages them. This massively improves facial recognition accuracy compared to a single snapshot.
* **Blink-Based Liveness Detection:**
  * **Action:** Upgraded `app/student/verify/page.tsx` to require a physical blink before marking attendance.
  * **Decision:** Implemented using the browser's native `FaceDetector` API (via `requestAnimationFrame`). It detects eye landmarks and triggers auto-capture only when an eye-close-then-open sequence is registered. This prevents students from spoofing attendance by holding a photograph to the camera. Added an 8-second fallback to a manual button if the browser doesn't support the API.
* **Camera UI/Layout Fixes:**
  * **Action:** Increased the camera oval size to `w-72 h-[22rem]` (12% larger) on both pages to make framing easier for students.
  * **Action:** Fixed an intermittent bug where the capture button wouldn't appear by adding a `readyState >= 1` fallback to the `video.onloadedmetadata` event listener.
  * **Action:** Fixed a major layout bug where the "Begin Scan" / "Capture" buttons were hidden behind the mobile bottom navigation bar. Changed the container height from `h-screen` to `calc(100dvh - 64px)` to properly account for the nav height.

## 7. Railway Port Routing & 502 Bad Gateway Resolution
After deploying the Dockerized backend, the API was returning a `502 Bad Gateway` (and the frontend was reporting a `Network error: failed to fetch`), despite Railway marking the deployment as "Active".

* **The Cause:** Railway's edge proxy (Hikari) was failing to route traffic to the Uvicorn server. Our Dockerfile used `CMD ["sh", "-c", "..."]` to evaluate the dynamic port, which caused Uvicorn to spawn as a child process (PID 2) on port 8080. Railway's port-detection algorithm failed to properly map the public URL to this child process's port.
* **The Fix:** We explicitly added `PORT=8000` to the Railway Environment Variables dashboard.
* **Decision:** By strictly defining the `PORT` variable at the platform level, we forced both the Uvicorn server and the Railway load balancer to perfectly synchronize on port 8000, completely bypassing Railway's automatic port detection quirks. This fully resolved the network errors and successfully connected the Vercel frontend to the Python backend.
