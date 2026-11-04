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
        if settings.dev_mock_auth:
            logger.warning(
                "Firebase credentials file not found at '%s'. Running with dev mock auth enabled.",
                path,
            )
            return
        raise RuntimeError(
            f"Firebase credentials file not found at '{path}'. "
            "Set FIREBASE_CREDENTIALS_PATH in your .env."
        )
    firebase_admin.initialize_app(credentials.Certificate(path))


def verify_firebase_token(token: str) -> dict:
    """Return the decoded Firebase claims (uid, email, name, picture...) or raise 401."""
    # Dev mock token support
    if settings.dev_mock_auth and (token.startswith("mock-") or token.startswith("dev-")):
        # e.g. mock-admin-1 -> email: admin@eventra.local
        parts = token.split(":")
        if len(parts) >= 3:
            uid, email, name = parts[0], parts[1], parts[2]
            return {"uid": uid, "email": email, "name": name, "picture": None}
        clean_name = token.replace("mock-", "").replace("dev-", "")
        email = f"{clean_name}@eventra.local"
        if "admin" in clean_name.lower():
            email = "admin@eventra.local"
        return {
            "uid": f"uid_{token}",
            "email": email,
            "name": clean_name.replace("-", " ").title(),
            "picture": None,
        }

    if not firebase_admin._apps:
        if settings.dev_mock_auth:
            return {
                "uid": f"uid_{token[-10:] if len(token) > 10 else token}",
                "email": "student@eventra.local",
                "name": "Dev User",
                "picture": None,
            }
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Firebase Admin SDK is not initialized",
        )

    try:
        return firebase_auth.verify_id_token(token)
    except (ValueError, FirebaseError) as exc:
        logger.info("Rejected Firebase token: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
