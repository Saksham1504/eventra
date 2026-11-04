"""Feature 3: QR entry. The database decides who gets in, once."""
from fastapi import APIRouter, HTTPException
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError

from app.core.dependencies import ApprovedOrganizer
from app.database import DbSession
from app.models import CheckIn, Event, EventStatus, Ticket, TicketStatus, TicketType, User
from app.routers.events import assert_owner
from app.schemas.misc import CheckInRequest, CheckInResult
from app.services import qr_service
from app.utils.time import utcnow

router = APIRouter(prefix="/checkin", tags=["check-in"])


@router.post("", response_model=CheckInResult)
def scan(body: CheckInRequest, user: ApprovedOrganizer, db: DbSession):
    """Called by the organizer's scanner. Always answers 200 with a `result` the UI can colour:
    ADMITTED (green), ALREADY_USED / CANCELLED / INVALID / WRONG_EVENT / EVENT_NOT_ACTIVE (red)."""
    event = db.get(Event, body.event_id)
    if event is None:
        raise HTTPException(404, "Event not found")
    assert_owner(event, user)
    if event.status not in (EventStatus.PUBLISHED, EventStatus.COMPLETED):
        return CheckInResult(result="EVENT_NOT_ACTIVE", message=f"Event is {event.status.value}")

    ticket = db.scalar(select(Ticket).where(Ticket.qr_token_hash == qr_service.hash_token(body.token)))
    if ticket is None:
        return CheckInResult(result="INVALID", message="Unknown QR code")

    tt = db.get(TicketType, ticket.ticket_type_id)
    attendee = db.get(User, ticket.user_id)
    info = dict(ticket_id=ticket.id, attendee_name=attendee.name, ticket_type=tt.name)

    if tt.event_id != event.id:
        return CheckInResult(result="WRONG_EVENT", message="This ticket is for a different event", **info)
    if ticket.status in (TicketStatus.CANCELLED, TicketStatus.REFUNDED):
        return CheckInResult(result="CANCELLED", message="This ticket was cancelled", **info)
    if ticket.status == TicketStatus.USED:
        return CheckInResult(result="ALREADY_USED", message="Already checked in", used_at=ticket.used_at, **info)

    # Atomic claim: only one scanner can flip ACTIVE -> USED, whatever the timing.
    now = utcnow()
    claimed = db.execute(
        update(Ticket).where(Ticket.id == ticket.id, Ticket.status == TicketStatus.ACTIVE)
        .values(status=TicketStatus.USED, used_at=now)
    ).rowcount
    if claimed != 1:
        db.rollback()
        fresh = db.scalar(select(Ticket).where(Ticket.id == ticket.id).execution_options(populate_existing=True))
        return CheckInResult(result="ALREADY_USED", message="Already checked in", used_at=fresh.used_at, **info)

    db.add(CheckIn(ticket_id=ticket.id, event_id=event.id, verified_by=user.id, gate_name=body.gate_name))
    try:
        db.commit()
    except IntegrityError:  # unique(ticket_id) is the second safety net
        db.rollback()
        return CheckInResult(result="ALREADY_USED", message="Already checked in", **info)
    return CheckInResult(result="ADMITTED", message="Welcome! Entry recorded", used_at=now, **info)
