---
title: EduVerify API
emoji: 🎓
colorFrom: green
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# EduVerify API

Face-verification and attendance backend for EduVerify (FastAPI + DeepFace + Firebase Admin).

The YAML block above is read by Hugging Face Spaces — keep it at the top of this file.

## Endpoints

All endpoints except `/api/health` need `Authorization: Bearer <Firebase ID token>`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Liveness check |
| POST | `/api/face/enroll` | Add a face sample for the signed-in user |
| GET | `/api/face/status` | Whether the signed-in user has enrolled a face |
| DELETE | `/api/face/me` | Delete the signed-in user's face data |
| POST | `/api/attendance/mark` | Verify session window, enrollment, GPS and face, then record attendance |

## Configuration (Space secrets / environment variables)

| Name | Required | Example |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | yes | Contents of the Firebase service-account key file (raw JSON or base64) |
| `ALLOWED_ORIGINS` | yes | `https://your-site.vercel.app,http://localhost:3000` |
| `MATCH_THRESHOLD` | no | `0.65` |

Locally, put `FIREBASE_SERVICE_ACCOUNT_PATH=<path to key file>` in `.env` instead.

## Running

Local demo (from the project root): `npm run demo` — starts this API, the Next.js site and a Cloudflare tunnel.

The Dockerfile also runs on Hugging Face Spaces (Docker) and Google Cloud Run (`.gcloudignore` included) if cloud hosting is needed later.
