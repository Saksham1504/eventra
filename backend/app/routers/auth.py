from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.config import settings
from app.core.dependencies import CurrentUser, TokenClaims
from app.database import DbSession
from app.models.user import User, UserRole
from app.schemas.user import UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=UserOut)
def login(claims: TokenClaims, db: DbSession):
    """Called by the frontend right after Firebase Google sign-in.
    Creates the user on first login, otherwise returns the existing user."""
    user = db.scalar(select(User).where(User.google_uid == claims["uid"]))

    if user is None:
        email = (claims.get("email") or "").lower()
        if not email:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Google account has no email")

        allowed = settings.allowed_domain_list
        if allowed and email.split("@")[-1] not in allowed:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Please sign in with your college email")

        role = UserRole.ADMIN if email in settings.admin_email_list else UserRole.STUDENT
        user = User(
            google_uid=claims["uid"],
            name=claims.get("name") or email.split("@")[0],
            email=email,
            avatar_url=claims.get("picture"),
            role=role,
        )
        db.add(user)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
        db.refresh(user)
    else:
        picture = claims.get("picture")
        if picture and picture != user.avatar_url:
            user.avatar_url = picture
            db.commit()

    return user


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser):
    return user
