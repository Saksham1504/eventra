from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from app.core.dependencies import ApprovedOrganizer, OptionalUser
from app.database import DbSession
from app.models import Booking, BookingStatus, Event, EventStatus, TicketType, User, UserRole
from app.schemas.event import EventCreate, EventOut, EventUpdate, TicketTypeCreate, TicketTypeOut
from app.services import booking_service
from app.services.availability_service import notify_event_changed
from app.services.notification_service import notify_many
from app.services.pricing_service import build_tier_rows, money
from app.services.serializers import event_out, ticket_type_out
from app.utils.ids import new_uuid
from app.utils.time import utcnow

router = APIRouter(prefix="/events", tags=["events"])

_EAGER = (selectinload(Event.ticket_types), selectinload(Event.organizer))


def get_event_or_404(db, event_id: str) -> Event:
    event = db.scalar(select(Event).where(Event.id == event_id).options(*_EAGER))
    if event is None:
        raise HTTPException(404, "Event not found")
    return event


def assert_owner(event: Event, user: User) -> None:
    if user.role != UserRole.ADMIN and event.organizer_id != user.id:
        raise HTTPException(403, "You do not own this event")


# ------------------------------------------------------------------ public discovery
@router.get("", response_model=list[EventOut])
def list_events(
    db: DbSession,
    q: str | None = None,
    category: str | None = None,
    include_past: bool = False,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    stmt = select(Event).where(Event.status == EventStatus.PUBLISHED).options(*_EAGER)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Event.title.ilike(like), Event.description.ilike(like), Event.venue.ilike(like)))
    if category:
        stmt = stmt.where(Event.category == category)
    if not include_past:
        stmt = stmt.where(Event.end_time >= utcnow())
    events = db.scalars(stmt.order_by(Event.start_time).limit(limit).offset(offset)).all()
    return [event_out(e) for e in events]


@router.get("/categories", response_model=list[str])
def list_categories(db: DbSession):
    rows = db.scalars(
        select(Event.category).where(Event.status == EventStatus.PUBLISHED, Event.category.is_not(None)).distinct()
    ).all()
    return sorted(rows)


@router.get("/mine", response_model=list[EventOut])
def my_events(user: ApprovedOrganizer, db: DbSession):
    events = db.scalars(
        select(Event).where(Event.organizer_id == user.id).options(*_EAGER).order_by(Event.start_time.desc())
    ).all()
    return [event_out(e) for e in events]


@router.get("/{event_id}", response_model=EventOut)
def get_event(event_id: str, db: DbSession, user: OptionalUser):
    event = get_event_or_404(db, event_id)
    if event.status == EventStatus.DRAFT:
        is_owner = user and (user.id == event.organizer_id or user.role == UserRole.ADMIN)
        if not is_owner:
            raise HTTPException(404, "Event not found")
    return event_out(event)


# ------------------------------------------------------------------ organizer: events
@router.post("", response_model=EventOut, status_code=status.HTTP_201_CREATED)
def create_event(body: EventCreate, user: ApprovedOrganizer, db: DbSession):
    event = Event(id=new_uuid(), organizer_id=user.id, status=EventStatus.DRAFT, **body.model_dump())
    db.add(event)
    db.commit()
    return event_out(get_event_or_404(db, event.id))


@router.patch("/{event_id}", response_model=EventOut)
def update_event(event_id: str, body: EventUpdate, user: ApprovedOrganizer, db: DbSession):
    event = get_event_or_404(db, event_id)
    assert_owner(event, user)
    if event.status in (EventStatus.CANCELLED, EventStatus.COMPLETED):
        raise HTTPException(409, f"A {event.status.value} event cannot be edited")

    changes = body.model_dump(exclude_unset=True)
    old = (event.venue, event.start_time, event.end_time)
    for field, value in changes.items():
        setattr(event, field, value)
    if event.end_time <= event.start_time:
        raise HTTPException(422, "end_time must be after start_time")
    if event.registration_deadline and event.registration_deadline > event.start_time:
        raise HTTPException(422, "registration_deadline must be before start_time")

    if event.status == EventStatus.PUBLISHED and old != (event.venue, event.start_time, event.end_time):
        attendee_ids = db.scalars(
            select(Booking.user_id)
            .join(TicketType, TicketType.id == Booking.ticket_type_id)
            .where(TicketType.event_id == event.id, Booking.status == BookingStatus.CONFIRMED)
        ).all()
        notify_many(db, attendee_ids, "Event details changed",
                    f"The venue or timing of {event.title} was updated. Please check the event page.", "EVENT_UPDATED")
    db.commit()
    return event_out(get_event_or_404(db, event.id))


@router.post("/{event_id}/publish", response_model=EventOut)
def publish_event(event_id: str, user: ApprovedOrganizer, db: DbSession):
    event = get_event_or_404(db, event_id)
    assert_owner(event, user)
    if event.status != EventStatus.DRAFT:
        raise HTTPException(409, "Only draft events can be published")
    if not event.ticket_types:
        raise HTTPException(409, "Add at least one ticket type before publishing")
    if event.end_time <= utcnow():
        raise HTTPException(409, "This event is already in the past")
    event.status = EventStatus.PUBLISHED
    db.commit()
    return event_out(get_event_or_404(db, event.id))


@router.post("/{event_id}/cancel", response_model=EventOut)
def cancel_event(event_id: str, background: BackgroundTasks, user: ApprovedOrganizer, db: DbSession):
    event = get_event_or_404(db, event_id)
    assert_owner(event, user)
    if event.status not in (EventStatus.DRAFT, EventStatus.PUBLISHED):
        raise HTTPException(409, f"A {event.status.value} event cannot be cancelled")
    event.status = EventStatus.CANCELLED
    booking_service.cancel_event_bookings(db, event)
    db.commit()
    background.add_task(notify_event_changed, event.id)
    return event_out(get_event_or_404(db, event.id))


# ------------------------------------------------------------------ organizer: ticket types
@router.post("/{event_id}/ticket-types", response_model=TicketTypeOut, status_code=status.HTTP_201_CREATED)
def add_ticket_type(event_id: str, body: TicketTypeCreate, user: ApprovedOrganizer, db: DbSession):
    event = get_event_or_404(db, event_id)
    assert_owner(event, user)
    if event.status in (EventStatus.CANCELLED, EventStatus.COMPLETED):
        raise HTTPException(409, f"A {event.status.value} event cannot be changed")
    if any(t.name.lower() == body.name.lower() for t in event.ticket_types):
        raise HTTPException(409, "A ticket type with this name already exists for the event")

    tt = TicketType(
        id=new_uuid(), event_id=event.id, sold_count=0, reserved_count=0,
        current_price=money(body.base_price), **body.model_dump(),
    )
    tt.base_price = money(body.base_price)
    db.add(tt)
    db.flush()
    db.add_all(build_tier_rows(tt))
    db.commit()
    db.refresh(tt)
    return ticket_type_out(tt)
