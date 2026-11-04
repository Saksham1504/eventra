from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from pydantic import BaseModel

from app.config import settings
from app.core.dependencies import CurrentUser
from app.database import DbSession
from app.models import Booking, BookingStatus, Payment, PaymentStatus, TicketType
from app.schemas.booking import PaymentCheckout, PaymentOut, PaymentResult
from app.services import booking_service
from app.services.availability_service import notify_event_changed
from app.services.serializers import bookings_out
from app.utils.time import utcnow
from sqlalchemy import select
from app.utils.ids import new_uuid

router = APIRouter(prefix="/payments", tags=["payments"])


def _out(p: Payment) -> PaymentOut:
    return PaymentOut(id=p.id, booking_id=p.booking_id, provider=p.provider, amount=p.amount,
                      status=p.status, created_at=p.created_at, paid_at=p.paid_at)


@router.post("/checkout", response_model=PaymentOut, status_code=status.HTTP_201_CREATED)
def checkout(body: PaymentCheckout, user: CurrentUser, db: DbSession):
    """Start paying for a PENDING booking. Returns the existing pending payment if there is one."""
    booking = db.get(Booking, body.booking_id)
    if booking is None or booking.user_id != user.id:
        raise HTTPException(404, "Booking not found")
    if booking.status != BookingStatus.PENDING:
        raise HTTPException(409, f"Booking is {booking.status.value}, nothing to pay")
    if booking.expires_at and booking.expires_at < utcnow():
        raise HTTPException(409, "Your reservation expired. Please book again.")

    existing = db.scalar(select(Payment).where(Payment.booking_id == booking.id, Payment.status == PaymentStatus.PENDING))
    if existing:
        return _out(existing)
    payment = Payment(
        id=new_uuid(), booking_id=booking.id, provider=settings.payment_mode,
        provider_payment_id=f"mock_{new_uuid()}" if settings.payment_mode == "mock" else None,
        amount=booking.total_amount, status=PaymentStatus.PENDING,
    )
    db.add(payment)
    db.commit()
    return _out(payment)


def _mock_complete(payment_id: str, success: bool, background: BackgroundTasks, user, db) -> PaymentResult:
    if settings.payment_mode != "mock":
        raise HTTPException(404, "Not found")
    payment = db.get(Payment, payment_id)
    booking = db.get(Booking, payment.booking_id) if payment else None
    if booking is None or (booking.user_id != user.id and user.role.value != "ADMIN"):
        raise HTTPException(404, "Payment not found")

    booking, payment = booking_service.complete_payment(db, payment_id, success)
    tt = db.get(TicketType, booking.ticket_type_id)
    background.add_task(notify_event_changed, tt.event_id)
    if payment.status == PaymentStatus.REFUNDED:
        raise HTTPException(409, "Your reservation expired and the tickets sold out. The payment was refunded.")
    return PaymentResult(payment=_out(payment), booking=bookings_out(db, [booking])[0])


@router.post("/{payment_id}/mock-confirm", response_model=PaymentResult)
def mock_confirm(payment_id: str, background: BackgroundTasks, user: CurrentUser, db: DbSession):
    """DEV ONLY (PAYMENT_MODE=mock): pretend the payment succeeded."""
    return _mock_complete(payment_id, True, background, user, db)


@router.post("/{payment_id}/mock-fail", response_model=PaymentResult)
def mock_fail(payment_id: str, background: BackgroundTasks, user: CurrentUser, db: DbSession):
    """DEV ONLY (PAYMENT_MODE=mock): pretend the payment failed. The reservation stays until it expires."""
    return _mock_complete(payment_id, False, background, user, db)


class RazorpayOrderOut(BaseModel):
    order_id: str
    amount: int
    currency: str
    key_id: str
    payment_id: str


class RazorpayVerifyRequest(BaseModel):
    payment_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


@router.post("/razorpay-order", response_model=RazorpayOrderOut)
def get_razorpay_order(body: PaymentCheckout, user: CurrentUser, db: DbSession):
    """Generates a Razorpay order for an active pending booking."""
    from app.services import razorpay_service
    booking = db.get(Booking, body.booking_id)
    if booking is None or booking.user_id != user.id:
        raise HTTPException(404, "Booking not found")
    if booking.status != BookingStatus.PENDING:
        raise HTTPException(409, f"Booking is {booking.status.value}, cannot pay")

    payment = db.scalar(select(Payment).where(Payment.booking_id == booking.id, Payment.status == PaymentStatus.PENDING))
    if not payment:
        payment = Payment(
            id=new_uuid(), booking_id=booking.id, provider="razorpay",
            amount=booking.total_amount, status=PaymentStatus.PENDING,
        )
        db.add(payment)
        db.commit()

    order_info = razorpay_service.create_order(booking.id, float(booking.total_amount))
    payment.provider_payment_id = order_info["order_id"]
    db.commit()
    return RazorpayOrderOut(payment_id=payment.id, **order_info)


@router.post("/razorpay-verify", response_model=PaymentResult)
def verify_razorpay_payment(
    body: RazorpayVerifyRequest, background: BackgroundTasks, user: CurrentUser, db: DbSession
):
    from app.services import razorpay_service
    payment = db.get(Payment, body.payment_id)
    if payment is None or payment.status != PaymentStatus.PENDING:
        raise HTTPException(404, "Payment not found or already completed")
    booking = db.get(Booking, payment.booking_id)
    if booking is None or booking.user_id != user.id:
        raise HTTPException(403, "Unauthorized")

    is_valid = razorpay_service.verify_signature(
        body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature
    )
    if not is_valid:
        raise HTTPException(400, "Invalid signature")

    payment.provider_payment_id = body.razorpay_payment_id
    booking, payment = booking_service.complete_payment(db, payment.id, True)
    tt = db.get(TicketType, booking.ticket_type_id)
    background.add_task(notify_event_changed, tt.event_id)
    return PaymentResult(payment=_out(payment), booking=bookings_out(db, [booking])[0])
