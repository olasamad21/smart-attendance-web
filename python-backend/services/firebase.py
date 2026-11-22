"""
Firebase Admin initialisation + request authentication.

Credentials are read from (first match wins):
  1. FIREBASE_SERVICE_ACCOUNT_JSON  — the service-account JSON itself (raw or base64).
                                      Best for Railway/hosted envs.
  2. FIREBASE_SERVICE_ACCOUNT_PATH  — path to the service-account JSON file.
  3. GOOGLE_APPLICATION_CREDENTIALS / Application Default Credentials.
"""
import base64
import json
import os
from functools import lru_cache

import firebase_admin
from fastapi import Header, HTTPException
from firebase_admin import auth as fb_auth
from firebase_admin import credentials, firestore


def _load_credentials():
    raw = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
    if raw:
        if not raw.startswith("{"):
            raw = base64.b64decode(raw).decode("utf-8")
        return credentials.Certificate(json.loads(raw))

    path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "").strip()
    if path:
        return credentials.Certificate(path)

    return credentials.ApplicationDefault()


@lru_cache(maxsize=1)
def get_app() -> firebase_admin.App:
    if firebase_admin._apps:
        return firebase_admin.get_app()
    return firebase_admin.initialize_app(_load_credentials())


def get_db():
    """Firestore client (bypasses security rules — server-trusted)."""
    return firestore.client(get_app())


def require_uid(authorization: str | None = Header(default=None)) -> str:
    """
    FastAPI dependency: verifies the `Authorization: Bearer <Firebase ID token>`
    header and returns the caller's uid. The uid is NEVER taken from the request body.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing authentication token.")
    token = authorization.split(" ", 1)[1].strip()
    app = get_app()  # outside the try: missing server credentials must surface as a 500, not a 401
    try:
        decoded = fb_auth.verify_id_token(token, app=app, check_revoked=False)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired session. Please sign in again.")
    return decoded["uid"]
