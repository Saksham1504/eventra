from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select

from app.core.security import verify_firebase_token
from app.database import DbSession
from app.models.user import User, UserRole, VerificationStatus

bearer_scheme = HTTPBearer(auto_error=False)


def get_token_claims(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> dict:
    if creds is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return verify_firebase_token(creds.credentials)


TokenClaims = Annotated[dict, Depends(get_token_claims)]


def get_current_user(claims: TokenClaims, db: DbSession) -> User:
    user = db.scalar(select(User).where(User.google_uid == claims["uid"]))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not registered. Call POST /auth/login first.",
        )
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_optional_user(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: DbSession,
) -> User | None:
    """For public endpoints that show a bit more to a logged-in owner (e.g. draft events)."""
    if creds is None:
        return None
    claims = verify_firebase_token(creds.credentials)
    return db.scalar(select(User).where(User.google_uid == claims["uid"]))


OptionalUser = Annotated[User | None, Depends(get_optional_user)]


def require_roles(*roles: UserRole):
    """Dependency factory: allow only the given roles."""

    def checker(user: CurrentUser) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user

    return checker


def require_approved_organizer(
    user: Annotated[User, Depends(require_roles(UserRole.ORGANIZER, UserRole.ADMIN))],
) -> User:
    """Organizers must have an APPROVED profile. Admins always pass."""
    if user.role == UserRole.ADMIN:
        return user
    profile = user.organizer_profile
    if profile is None or profile.verification_status != VerificationStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Organizer profile is not approved yet",
        )
    return user


AdminUser = Annotated[User, Depends(require_roles(UserRole.ADMIN))]
ApprovedOrganizer = Annotated[User, Depends(require_approved_organizer)]
