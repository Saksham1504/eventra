from pydantic import BaseModel, Field

from app.models.booking import BookingStatus, PaymentStatus, TicketStatus
from app.schemas.common import Money, UtcDatetime


class BookingCreate(BaseModel):
    ticket_type_id: str
    quantity: int = Field(default=1, ge=1)


class BookingOut(BaseModel):
    id: str
    status: BookingStatus
    quantity: int
    unit_price: Money
    total_amount: Money
    created_at: UtcDatetime
    expires_at: UtcDatetime | None
    ticket_type_id: str
    ticket_type_name: str
    event_id: str
    event_title: str
    event_start_time: UtcDatetime
    ticket_ids: list[str]


class PaymentCheckout(BaseModel):
    booking_id: str


class PaymentOut(BaseModel):
    id: str
    booking_id: str
    provider: str | None
    amount: Money
    status: PaymentStatus
    created_at: UtcDatetime
    paid_at: UtcDatetime | None


class PaymentResult(BaseModel):
    payment: PaymentOut
    booking: BookingOut


class TicketOut(BaseModel):
    id: str
    booking_id: str
    status: TicketStatus
    issued_at: UtcDatetime
    used_at: UtcDatetime | None
    qr_token: str
    ticket_type_name: str
    event_id: str
    event_title: str
    venue: str
    event_start_time: UtcDatetime
