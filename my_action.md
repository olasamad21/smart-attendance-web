# Action Documentation: Face Detection Improvements

## Background
The previous detector backends (`yunet` and `opencv`) were failing to reliably detect faces in the browser's webcam capture, resulting in "No face detected" errors. To solve this, we moved to the `mtcnn` detector backend, which is much more robust against varying lighting, slight face angles, and webcam image quality.

## Actions Taken

1. **Verified MTCNN Dependency**
   - Executed `pip install mtcnn` in the virtual environment. It was already satisfied, so no new packages needed to be downloaded.

2. **Updated Face Service (`python-backend/services/face_service.py`)**
   - Modified the `enroll_face` function to use `detector_backend="mtcnn"` instead of `"opencv"`.
   - Modified the `verify_face` function to use `detector_backend="mtcnn"` instead of `"opencv"`.
   - Kept the `model_name="ArcFace"` for state-of-the-art recognition.
   - Maintained `enforce_detection=True` so that the system correctly rejects images without a valid face.

## Next Steps
- The Python backend needs to be restarted for the changes to take effect.
- Test the enrollment process at `/student/enroll` to confirm the robust detection.

---

## Update — Hardened Face Service (2026-08-12)

### Changes Made

1. **Replaced `python-backend/services/face_service.py` entirely**
   - Switched recognition model from **ArcFace** → **Facenet512** (higher-dimensional, more discriminative embeddings).
   - Switched detector backend from **mtcnn** → **opencv** (more reliable with browser webcam images).
   - Added **multi-sample enrollment**: calling enroll multiple times averages up to 5 embedding samples for more robust matching.
   - Extracted `get_embedding()` and `cosine_similarity()` as reusable helper functions.
   - Changed confidence calculation: now uses direct cosine similarity (0–1 scale → 0–100%) instead of the previous `(similarity + 1) / 2` formula.
   - Match threshold is now **configurable via environment variable** (`MATCH_THRESHOLD=0.65`, i.e. 65%).

2. **Updated `python-backend/routes/face.py`**
   - Added new endpoint `POST /api/face/enroll/add-sample` to allow students to submit additional face samples to improve matching accuracy.

3. **Updated `python-backend/.env`**
   - Added `MATCH_THRESHOLD=0.65` (configurable matching strictness).
   - Added `ENROLLMENT_SAMPLES=3` (target number of samples for enrollment).

### Important
- **Re-enrollment required**: Since the model changed from ArcFace to Facenet512, all existing face data in `./face_data/` is now incompatible. Students must re-enroll.
- Restart the Python backend for changes to take effect.
