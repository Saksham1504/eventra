import logging
import os

import firebase_admin
from fastapi import HTTPException, status
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials
from firebase_admin.exceptions import FirebaseError

from app.config import settings

logger = logging.getLogger(__name__)


def init_firebase() -> None:
    """Initialise the Firebase Admin SDK once, at app startup."""
    if firebase_admin._apps:
        return
    path = settings.firebase_credentials_path
    if not os.path.exists(path):
        raise RuntimeError(
            f"Firebase credentials file not found at '{path}'. "
            "Set FIREBASE_CREDENTIALS_PATH in your .env."
        )
    firebase_admin.initialize_app(credentials.Certificate(path))


def verify_firebase_token(token: str) -> dict:
    """Return the decoded Firebase claims (uid, email, name, picture...) or raise 401."""
    try:
        return firebase_auth.verify_id_token(token)
    except (ValueError, FirebaseError) as exc:
        logger.info("Rejected Firebase token: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
