"""Feature 1: dynamic pricing.

Rule: price = base_price * (1 + increment%) ^ tier
      tier  = floor(confirmed_sold / (capacity * step%))

With the defaults (25% / 20%) and capacity 100, price goes up by 25% at 20, 40, 60 and 80 sold.
The price depends ONLY on confirmed sales (sold_count), never on pending reservations.
Tier 0 -> 1 -> ... and back down if confirmed tickets are cancelled (price is a pure function of sold_count).
"""
from decimal import ROUND_CEILING, ROUND_FLOOR, ROUND_HALF_UP, Decimal

from sqlalchemy.orm import Session

from app.models import PriceHistory, PricingTier, TicketType
from app.utils.ids import new_uuid

CENT = Decimal("0.01")


def money(value) -> Decimal:
    """The single rounding policy for currency: 2 decimals, half-up."""
    return Decimal(value).quantize(CENT, rounding=ROUND_HALF_UP)


def tier_for_sold(sold: int, capacity: int, step_percent) -> int:
    step = Decimal(step_percent)
    if step <= 0 or capacity <= 0:
        return 0
    return int((Decimal(sold) * 100 / (Decimal(capacity) * step)).to_integral_value(ROUND_FLOOR))


def price_for_tier(base_price, increment_percent, tier: int) -> Decimal:
    factor = Decimal(1) + Decimal(increment_percent) / Decimal(100)
    return money(Decimal(base_price) * factor**tier)


def current_price_for(tt: TicketType) -> Decimal:
    tier = tier_for_sold(tt.sold_count, tt.capacity, tt.capacity_step_percent)
    return price_for_tier(tt.base_price, tt.increment_percent, tier)


def pricing_info(tt: TicketType) -> dict:
    """Everything the UI needs to show: price now, next price and how many tickets until it."""
    step = Decimal(tt.capacity_step_percent)
    tier = tier_for_sold(tt.sold_count, tt.capacity, step)
    next_price = None
    until_next = None
    if step > 0:
        step_tickets = Decimal(tt.capacity) * step / 100
        next_threshold = int((step_tickets * (tier + 1)).to_integral_value(ROUND_CEILING))
        if next_threshold < tt.capacity:  # a jump that happens before sell-out
            next_price = price_for_tier(tt.base_price, tt.increment_percent, tier + 1)
            until_next = max(next_threshold - tt.sold_count, 0)
    return {
        "tier": tier,
        "current_price": money(tt.current_price),
        "next_price": next_price,
        "tickets_until_next_price": until_next,
    }


def build_tier_rows(tt: TicketType) -> list[PricingTier]:
    """Pre-computed price ladder for display (the pricing_tiers table)."""
    step = Decimal(tt.capacity_step_percent)
    rows: list[PricingTier] = []
    if step <= 0:
        return rows
    tier = 0
    while step * tier < 100:
        factor = (Decimal(1) + Decimal(tt.increment_percent) / 100) ** tier
        rows.append(
            PricingTier(
                id=new_uuid(),
                ticket_type_id=tt.id,
                tier_number=tier,
                min_sold_percent=step * tier,
                price_multiplier=factor.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP),
                price=price_for_tier(tt.base_price, tt.increment_percent, tier),
            )
        )
        tier += 1
    return rows


def sync_price(db: Session, tt: TicketType) -> bool:
    """Recompute current_price from sold_count. Logs to price_history when it changes.
    Call this inside the same transaction (and ticket_type row lock) that changed sold_count."""
    new_price = current_price_for(tt)
    if new_price == money(tt.current_price):
        return False
    db.add(
        PriceHistory(
            id=new_uuid(),
            ticket_type_id=tt.id,
            old_price=money(tt.current_price),
            new_price=new_price,
            sold_count=tt.sold_count,
            tier_number=tier_for_sold(tt.sold_count, tt.capacity, tt.capacity_step_percent),
        )
    )
    tt.current_price = new_price
    return True
