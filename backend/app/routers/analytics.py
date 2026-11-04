from fastapi import APIRouter
from sqlalchemy import func, select

from app.core.dependencies import ApprovedOrganizer
from app.database import DbSession
from app.models import (
    Booking, BookingStatus, CheckIn, Event, EventStatus, PriceHistory, Ticket, TicketStatus, TicketType, UserRole,
)
from app.routers.events import assert_owner, get_event_or_404

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/events/{event_id}")
def event_analytics(event_id: str, user: ApprovedOrganizer, db: DbSession):
    event = get_event_or_404(db, event_id)
    assert_owner(event, user)
    tt_ids = [t.id for t in event.ticket_types]

    per_type = []
    for tt in event.ticket_types:
        revenue = db.scalar(select(func.coalesce(func.sum(Booking.total_amount), 0))
                            .where(Booking.ticket_type_id == tt.id, Booking.status == BookingStatus.CONFIRMED))
        per_type.append({
            "ticket_type_id": tt.id, "name": tt.name, "capacity": tt.capacity, "sold": tt.sold_count,
            "reserved": tt.reserved_count, "current_price": float(tt.current_price), "revenue": float(revenue),
            "capacity_used_percent": round(100 * tt.sold_count / tt.capacity, 1) if tt.capacity else 0,
        })

    sales_rows = db.execute(
        select(func.date(Booking.created_at), func.sum(Booking.quantity), func.sum(Booking.total_amount))
        .where(Booking.ticket_type_id.in_(tt_ids or [""]), Booking.status == BookingStatus.CONFIRMED)
        .group_by(func.date(Booking.created_at)).order_by(func.date(Booking.created_at))
    ).all()

    history = db.execute(
        select(PriceHistory.ticket_type_id, PriceHistory.old_price, PriceHistory.new_price,
               PriceHistory.sold_count, PriceHistory.changed_at)
        .where(PriceHistory.ticket_type_id.in_(tt_ids or [""])).order_by(PriceHistory.changed_at)
    ).all()

    sold_total = sum(p["sold"] for p in per_type)
    checked_in = db.scalar(select(func.count()).select_from(CheckIn).where(CheckIn.event_id == event.id)) or 0
    return {
        "event_id": event.id, "title": event.title, "status": event.status.value,
        "totals": {
            "capacity": sum(p["capacity"] for p in per_type), "tickets_sold": sold_total,
            "revenue": sum(p["revenue"] for p in per_type), "checked_in": checked_in,
            "attendance_rate_percent": round(100 * checked_in / sold_total, 1) if sold_total else 0,
        },
        "ticket_types": per_type,
        "sales_by_day": [{"date": str(d), "tickets": int(q or 0), "revenue": float(r or 0)} for d, q, r in sales_rows],
        "price_changes": [{"ticket_type_id": t, "old_price": float(o), "new_price": float(n), "sold_count": s,
                           "changed_at": c.isoformat() + "Z"} for t, o, n, s, c in history],
    }


@router.get("/summary")
def organizer_summary(user: ApprovedOrganizer, db: DbSession):
    """All of this organizer's events at a glance (admins see every event)."""
    ev_filter = [] if user.role == UserRole.ADMIN else [Event.organizer_id == user.id]
    events = db.scalars(select(Event).where(*ev_filter)).all()
    ids = [e.id for e in events] or [""]
    sold, revenue = db.execute(
        select(func.coalesce(func.sum(Booking.quantity), 0), func.coalesce(func.sum(Booking.total_amount), 0))
        .join(TicketType, TicketType.id == Booking.ticket_type_id)
        .where(TicketType.event_id.in_(ids), Booking.status == BookingStatus.CONFIRMED)
    ).one()
    checked = db.scalar(select(func.count()).select_from(CheckIn).where(CheckIn.event_id.in_(ids))) or 0
    return {
        "events_total": len(events),
        "events_published": sum(1 for e in events if e.status == EventStatus.PUBLISHED),
        "tickets_sold": int(sold), "revenue": float(revenue), "checked_in": checked,
    }
