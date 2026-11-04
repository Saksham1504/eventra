from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.core.dependencies import AdminUser, CurrentUser
from app.database import DbSession
from app.models import College, OrganizerProfile, User, UserRole, VerificationStatus
from app.schemas.misc import (
    CollegeCreate, CollegeOut, OrganizerApply, OrganizerProfileOut, UserUpdate,
)
from app.schemas.user import UserOut
from app.services.notification_service import notify

router = APIRouter(tags=["users"])


@router.patch("/users/me", response_model=UserOut)
def update_me(body: UserUpdate, user: CurrentUser, db: DbSession):
    data = body.model_dump(exclude_unset=True)
    if data.get("college_id") and db.get(College, data["college_id"]) is None:
        raise HTTPException(404, "College not found")
    for k, v in data.items():
        setattr(user, k, v)
    db.commit()
    return user


@router.get("/colleges", response_model=list[CollegeOut])
def list_colleges(db: DbSession):
    return db.scalars(select(College).order_by(College.name)).all()


@router.post("/colleges", response_model=CollegeOut, status_code=201)
def create_college(body: CollegeCreate, admin: AdminUser, db: DbSession):
    college = College(**body.model_dump())
    db.add(college)
    db.commit()
    return college


# ---------------------------------------------------------------- organizer application
def _profile_out(p: OrganizerProfile) -> OrganizerProfileOut:
    return OrganizerProfileOut(
        id=p.id, user_id=p.user_id, club_name=p.club_name, description=p.description,
        verification_status=p.verification_status, created_at=p.created_at,
        user_name=p.user.name, user_email=p.user.email,
    )


@router.post("/organizers/apply", response_model=OrganizerProfileOut, status_code=201)
def apply_organizer(body: OrganizerApply, user: CurrentUser, db: DbSession):
    profile = user.organizer_profile
    if profile:
        if profile.verification_status != VerificationStatus.REJECTED:
            raise HTTPException(409, f"You already have an organizer application ({profile.verification_status.value})")
        profile.club_name, profile.description = body.club_name, body.description
        profile.verification_status = VerificationStatus.PENDING
    else:
        profile = OrganizerProfile(user_id=user.id, **body.model_dump())
        db.add(profile)
    if user.role == UserRole.STUDENT:
        user.role = UserRole.ORGANIZER   # can't create events until the profile is APPROVED
    db.commit()
    db.refresh(profile)
    return _profile_out(profile)


@router.get("/organizers/me", response_model=OrganizerProfileOut)
def my_organizer_profile(user: CurrentUser):
    if user.organizer_profile is None:
        raise HTTPException(404, "No organizer application yet")
    return _profile_out(user.organizer_profile)
