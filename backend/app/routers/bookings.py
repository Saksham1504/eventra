from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Response, status
from sqlalchemy import select

from app.core.dependencies import CurrentUser
from app.database import DbSession
from app.models import Booking, TicketType
from app.schemas.booking import BookingCreate, BookingOut
from app.services import booking_service
from app.services.availability_service import notify_event_changed
from app.services.serializers import bookings_out

router = APIRouter(prefix="/bookings", tags=["bookings"])


@router.post("", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
def create_booking(
    body: BookingCreate,
    response: Response,
    background: BackgroundTasks,
    user: CurrentUser,
    db: DbSession,
    idempotency_key: Annotated[str, Header(min_length=8, max_length=255, description="Unique per booking attempt, e.g. a UUID")],
):
    """Reserve tickets. The Idempotency-Key header makes retries/double-clicks safe:
    repeating the same request returns the same booking instead of creating a second one."""
    booking, created = booking_service.create_booking(db, user, body.ticket_type_id, body.quantity, idempotency_key)
    if not created:
        response.status_code = status.HTTP_200_OK
    else:
        tt = db.get(TicketType, booking.ticket_type_id)
        background.add_task(notify_event_changed, tt.event_id)
    return bookings_out(db, [booking])[0]


@router.get("/mine", response_model=list[BookingOut])
def my_bookings(user: CurrentUser, db: DbSession, status_filter: str | None = None):
    stmt = select(Booking).where(Booking.user_id == user.id).order_by(Booking.created_at.desc())
    if status_filter:
        stmt = stmt.where(Booking.status == status_filter.upper())
    return bookings_out(db, list(db.scalars(stmt).all()))


@router.get("/{booking_id}", response_model=BookingOut)
def get_booking(booking_id: str, user: CurrentUser, db: DbSession):
    booking = db.get(Booking, booking_id)
    if booking is None or (booking.user_id != user.id and user.role.value != "ADMIN"):
        raise HTTPException(404, "Booking not found")
    return bookings_out(db, [booking])[0]


@router.post("/{booking_id}/cancel", response_model=BookingOut)
def cancel_booking(booking_id: str, background: BackgroundTasks, user: CurrentUser, db: DbSession):
    booking = booking_service.cancel_booking(db, user, booking_id)
    tt = db.get(TicketType, booking.ticket_type_id)
    background.add_task(notify_event_changed, tt.event_id)
    return bookings_out(db, [booking])[0]
