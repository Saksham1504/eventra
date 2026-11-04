from fastapi import APIRouter, BackgroundTasks, HTTPException
from sqlalchemy import select

from app.core.dependencies import ApprovedOrganizer
from app.database import DbSession
from app.models import Event, PriceHistory, PricingTier, TicketType
from app.schemas.event import (
    PriceHistoryOut, PricingTierOut, TicketTypeOut, TicketTypePricingOut, TicketTypeUpdate,
)
from app.routers.events import assert_owner
from app.services.availability_service import notify_event_changed
from app.services.booking_service import lock_ticket_type
from app.services.pricing_service import build_tier_rows, current_price_for, money, sync_price
from app.services.serializers import ticket_type_out

router = APIRouter(prefix="/ticket-types", tags=["ticket types"])


@router.get("/{ticket_type_id}/pricing", response_model=TicketTypePricingOut)
def pricing(ticket_type_id: str, db: DbSession):
    """Public: current price, the whole price ladder and the history of price changes."""
    tt = db.get(TicketType, ticket_type_id)
    if tt is None:
        raise HTTPException(404, "Ticket type not found")
    tiers = db.scalars(select(PricingTier).where(PricingTier.ticket_type_id == tt.id).order_by(PricingTier.tier_number)).all()
    history = db.scalars(select(PriceHistory).where(PriceHistory.ticket_type_id == tt.id).order_by(PriceHistory.changed_at)).all()
    out = ticket_type_out(tt)
    return TicketTypePricingOut(
        ticket_type=out,
        tiers=[PricingTierOut(tier_number=t.tier_number, min_sold_percent=t.min_sold_percent, price=t.price,
                              is_current=money(t.price) == out.current_price) for t in tiers],
        history=[PriceHistoryOut(old_price=h.old_price, new_price=h.new_price, sold_count=h.sold_count,
                                 tier_number=h.tier_number, changed_at=h.changed_at) for h in history],
    )


@router.patch("/{ticket_type_id}", response_model=TicketTypeOut)
def update_ticket_type(ticket_type_id: str, body: TicketTypeUpdate, background: BackgroundTasks,
                       user: ApprovedOrganizer, db: DbSession):
    tt = lock_ticket_type(db, ticket_type_id)
    event = db.get(Event, tt.event_id)
    assert_owner(event, user)

    changes = body.model_dump(exclude_unset=True)
    pricing_fields = {"base_price", "increment_percent", "capacity_step_percent"} & changes.keys()
    if pricing_fields and (tt.sold_count > 0 or tt.reserved_count > 0):
        raise HTTPException(409, "Pricing rules cannot change once tickets are sold or reserved")
    if "capacity" in changes and changes["capacity"] < tt.sold_count + tt.reserved_count:
        raise HTTPException(409, f"Capacity cannot go below tickets already sold or reserved ({tt.sold_count + tt.reserved_count})")
    if "name" in changes and changes["name"].lower() != tt.name.lower():
        siblings = db.scalars(select(TicketType.name).where(TicketType.event_id == tt.event_id, TicketType.id != tt.id)).all()
        if changes["name"].lower() in {n.lower() for n in siblings}:
            raise HTTPException(409, "A ticket type with this name already exists for the event")

    for field, value in changes.items():
        setattr(tt, field, money(value) if field == "base_price" else value)
    if tt.sales_start and tt.sales_end and tt.sales_end <= tt.sales_start:
        raise HTTPException(422, "sales_end must be after sales_start")

    if pricing_fields:
        tt.current_price = current_price_for(tt)
        for row in db.scalars(select(PricingTier).where(PricingTier.ticket_type_id == tt.id)).all():
            db.delete(row)
        db.flush()
        db.add_all(build_tier_rows(tt))
    elif "capacity" in changes:
        sync_price(db, tt)  # tier thresholds depend on capacity
    db.commit()
    background.add_task(notify_event_changed, tt.event_id)
    return ticket_type_out(tt)
