from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Booking, Event, Ticket, TicketType
from app.schemas.booking import BookingOut, TicketOut
from app.schemas.event import EventOut, TicketTypeOut
from app.services import qr_service
from app.services.pricing_service import pricing_info


def ticket_type_out(tt: TicketType) -> TicketTypeOut:
    info = pricing_info(tt)
    return TicketTypeOut(
        id=tt.id, event_id=tt.event_id, name=tt.name, capacity=tt.capacity,
        sold_count=tt.sold_count, reserved_count=tt.reserved_count,
        available=max(tt.capacity - tt.sold_count - tt.reserved_count, 0),
        base_price=tt.base_price, current_price=info["current_price"],
        next_price=info["next_price"], tickets_until_next_price=info["tickets_until_next_price"],
        increment_percent=tt.increment_percent, capacity_step_percent=tt.capacity_step_percent,
        currency=tt.currency, sales_start=tt.sales_start, sales_end=tt.sales_end,
    )


def event_out(event: Event) -> EventOut:
    return EventOut(
        id=event.id, organizer_id=event.organizer_id, organizer_name=event.organizer.name,
        title=event.title, description=event.description, category=event.category,
        banner_url=event.banner_url, venue=event.venue, start_time=event.start_time,
        end_time=event.end_time, registration_deadline=event.registration_deadline,
        status=event.status, created_at=event.created_at,
        ticket_types=[ticket_type_out(t) for t in sorted(event.ticket_types, key=lambda t: t.created_at or 0)],
    )


def bookings_out(db: Session, bookings: list[Booking]) -> list[BookingOut]:
    if not bookings:
        return []
    tts = {t.id: t for t in db.scalars(select(TicketType).where(TicketType.id.in_({b.ticket_type_id for b in bookings})))}
    events = {e.id: e for e in db.scalars(select(Event).where(Event.id.in_({t.event_id for t in tts.values()})))}
    ticket_ids: dict[str, list[str]] = {}
    for t_id, b_id in db.execute(select(Ticket.id, Ticket.booking_id).where(Ticket.booking_id.in_([b.id for b in bookings]))):
        ticket_ids.setdefault(b_id, []).append(t_id)
    out = []
    for b in bookings:
        tt = tts[b.ticket_type_id]
        ev = events[tt.event_id]
        out.append(BookingOut(
            id=b.id, status=b.status, quantity=b.quantity, unit_price=b.unit_price,
            total_amount=b.total_amount, created_at=b.created_at, expires_at=b.expires_at,
            ticket_type_id=tt.id, ticket_type_name=tt.name, event_id=ev.id, event_title=ev.title,
            event_start_time=ev.start_time, ticket_ids=ticket_ids.get(b.id, []),
        ))
    return out


def tickets_out(db: Session, tickets: list[Ticket]) -> list[TicketOut]:
    if not tickets:
        return []
    tts = {t.id: t for t in db.scalars(select(TicketType).where(TicketType.id.in_({t.ticket_type_id for t in tickets})))}
    events = {e.id: e for e in db.scalars(select(Event).where(Event.id.in_({t.event_id for t in tts.values()})))}
    out = []
    for t in tickets:
        tt = tts[t.ticket_type_id]
        ev = events[tt.event_id]
        out.append(TicketOut(
            id=t.id, booking_id=t.booking_id, status=t.status, issued_at=t.issued_at, used_at=t.used_at,
            qr_token=qr_service.make_token(t.id), ticket_type_name=tt.name, event_id=ev.id,
            event_title=ev.title, venue=ev.venue, event_start_time=ev.start_time,
        ))
    return out
