from decimal import Decimal

from pydantic import BaseModel, Field, model_validator

from app.models.event import EventStatus
from app.schemas.common import Money, UtcDatetime


class TicketTypeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    capacity: int = Field(gt=0, le=100000)
    base_price: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
    increment_percent: Decimal = Field(default=Decimal("25.00"), ge=0, le=500)
    capacity_step_percent: Decimal = Field(default=Decimal("20.00"), gt=0, le=100)
    currency: str = Field(default="INR", max_length=10)
    sales_start: UtcDatetime | None = None
    sales_end: UtcDatetime | None = None

    @model_validator(mode="after")
    def _dates(self):
        if self.sales_start and self.sales_end and self.sales_end <= self.sales_start:
            raise ValueError("sales_end must be after sales_start")
        return self


class TicketTypeUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    capacity: int | None = Field(default=None, gt=0, le=100000)
    base_price: Decimal | None = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    increment_percent: Decimal | None = Field(default=None, ge=0, le=500)
    capacity_step_percent: Decimal | None = Field(default=None, gt=0, le=100)
    sales_start: UtcDatetime | None = None
    sales_end: UtcDatetime | None = None


class TicketTypeOut(BaseModel):
    id: str
    event_id: str
    name: str
    capacity: int
    sold_count: int
    reserved_count: int
    available: int
    base_price: Money
    current_price: Money
    next_price: Money | None
    tickets_until_next_price: int | None
    increment_percent: Money
    capacity_step_percent: Money
    currency: str
    sales_start: UtcDatetime | None
    sales_end: UtcDatetime | None


class PricingTierOut(BaseModel):
    tier_number: int
    min_sold_percent: Money
    price: Money
    is_current: bool


class PriceHistoryOut(BaseModel):
    old_price: Money
    new_price: Money
    sold_count: int
    tier_number: int
    changed_at: UtcDatetime


class TicketTypePricingOut(BaseModel):
    ticket_type: TicketTypeOut
    tiers: list[PricingTierOut]
    history: list[PriceHistoryOut]


class EventCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    category: str | None = Field(default=None, max_length=100)
    banner_url: str | None = None
    venue: str = Field(min_length=1, max_length=255)
    start_time: UtcDatetime
    end_time: UtcDatetime
    registration_deadline: UtcDatetime | None = None

    @model_validator(mode="after")
    def _dates(self):
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        if self.registration_deadline and self.registration_deadline > self.start_time:
            raise ValueError("registration_deadline must be before start_time")
        return self


class EventUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    category: str | None = Field(default=None, max_length=100)
    banner_url: str | None = None
    venue: str | None = Field(default=None, min_length=1, max_length=255)
    start_time: UtcDatetime | None = None
    end_time: UtcDatetime | None = None
    registration_deadline: UtcDatetime | None = None


class EventOut(BaseModel):
    id: str
    organizer_id: str
    organizer_name: str
    title: str
    description: str | None
    category: str | None
    banner_url: str | None
    venue: str
    start_time: UtcDatetime
    end_time: UtcDatetime
    registration_deadline: UtcDatetime | None
    status: EventStatus
    created_at: UtcDatetime
    ticket_types: list[TicketTypeOut]
