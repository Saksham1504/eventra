from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from app.core.dependencies import AdminUser
from app.database import DbSession
from app.models import (
    Booking, BookingStatus, Event, EventStatus, OrganizerProfile, Ticket, User, UserRole, VerificationStatus,
)
from app.routers.users import _profile_out
from app.schemas.event import EventOut
from app.schemas.misc import OrganizerProfileOut, RoleUpdate
from app.schemas.user import UserOut
from app.services.notification_service import notify
from app.services.serializers import event_out

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats")
def stats(admin: AdminUser, db: DbSession):
    def count(model, *where):
        return db.scalar(select(func.count()).select_from(model).where(*where)) or 0

    revenue = db.scalar(select(func.coalesce(func.sum(Booking.total_amount), 0)).where(Booking.status == BookingStatus.CONFIRMED))
    return {
        "users": count(User),
        "organizers_pending": count(OrganizerProfile, OrganizerProfile.verification_status == VerificationStatus.PENDING),
        "events_published": count(Event, Event.status == EventStatus.PUBLISHED),
        "tickets_sold": count(Ticket),
        "revenue": float(revenue),
    }


@router.get("/users", response_model=list[UserOut])
def list_users(admin: AdminUser, db: DbSession, q: str | None = None, role: UserRole | None = None,
               limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)):
    stmt = select(User)
    if q:
        stmt = stmt.where(or_(User.name.ilike(f"%{q}%"), User.email.ilike(f"%{q}%")))
    if role:
        stmt = stmt.where(User.role == role)
    return db.scalars(stmt.order_by(User.created_at.desc()).limit(limit).offset(offset)).all()


@router.patch("/users/{user_id}/role", response_model=UserOut)
def set_role(user_id: str, body: RoleUpdate, admin: AdminUser, db: DbSession):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(404, "User not found")
    if user.id == admin.id and body.role != UserRole.ADMIN:
        raise HTTPException(409, "You cannot remove your own admin role")
    user.role = body.role
    db.commit()
    return user


@router.get("/organizers", response_model=list[OrganizerProfileOut])
def list_organizers(admin: AdminUser, db: DbSession, status: VerificationStatus | None = None):
    stmt = select(OrganizerProfile).options(selectinload(OrganizerProfile.user))
    if status:
        stmt = stmt.where(OrganizerProfile.verification_status == status)
    return [_profile_out(p) for p in db.scalars(stmt.order_by(OrganizerProfile.created_at.desc())).all()]


def _decide(profile_id: str, new_status: VerificationStatus, db) -> OrganizerProfileOut:
    p = db.get(OrganizerProfile, profile_id)
    if p is None:
        raise HTTPException(404, "Organizer application not found")
    p.verification_status = new_status
    verb = "approved" if new_status == VerificationStatus.APPROVED else "rejected"
    notify(db, p.user_id, f"Organizer application {verb}",
           f"Your application for {p.club_name} was {verb}.", "ORGANIZER_" + new_status.value)
    db.commit()
    return _profile_out(p)


@router.post("/organizers/{profile_id}/approve", response_model=OrganizerProfileOut)
def approve(profile_id: str, admin: AdminUser, db: DbSession):
    return _decide(profile_id, VerificationStatus.APPROVED, db)


@router.post("/organizers/{profile_id}/reject", response_model=OrganizerProfileOut)
def reject(profile_id: str, admin: AdminUser, db: DbSession):
    return _decide(profile_id, VerificationStatus.REJECTED, db)


@router.get("/events", response_model=list[EventOut])
def all_events(admin: AdminUser, db: DbSession, status: EventStatus | None = None,
               limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)):
    stmt = select(Event).options(selectinload(Event.ticket_types), selectinload(Event.organizer))
    if status:
        stmt = stmt.where(Event.status == status)
    return [event_out(e) for e in db.scalars(stmt.order_by(Event.created_at.desc()).limit(limit).offset(offset)).all()]
