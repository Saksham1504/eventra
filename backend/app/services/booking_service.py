"""Feature 2: concurrency-safe booking.

LOCK ORDER (always the same, so transactions never deadlock):
    ticket_types row  ->  bookings rows  ->  payments / tickets rows

The ticket_types row is the gate for an event's capacity. Anything that changes
sold_count / reserved_count first takes SELECT ... FOR UPDATE on that row, so two students
racing for the last ticket are serialised by the database, and the loser sees "sold out".
"""
import logging
from datetime import timedelta
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models import (
    Booking, BookingStatus, Event, EventStatus, Payment, PaymentStatus,
    Ticket, TicketStatus, TicketType, User,
)
from app.services import qr_service
from app.services.notification_service import notify, notify_many
from app.services.pricing_service import current_price_for, money, sync_price
from app.utils.ids import new_uuid
from app.utils.time import utcnow

logger = logging.getLogger(__name__)


def _http(code: int, detail: str) -> HTTPException:
    return HTTPException(status_code=code, detail=detail)


# ---------------------------------------------------------------- locking helpers
def lock_ticket_type(db: Session, ticket_type_id: str) -> TicketType:
    tt = db.scalar(
        select(TicketType)
        .where(TicketType.id == ticket_type_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if tt is None:
        raise _http(status.HTTP_404_NOT_FOUND, "Ticket type not found")
    return tt


def _lock_booking(db: Session, booking_id: str) -> Booking:
    return db.scalar(
        select(Booking).where(Booking.id == booking_id).with_for_update().execution_options(populate_existing=True)
    )


def _lock_payment(db: Session, payment_id: str) -> Payment:
    return db.scalar(
        select(Payment).where(Payment.id == payment_id).with_for_update().execution_options(populate_existing=True)
    )


def _fail_pending_payments(db: Session, booking_id: str) -> None:
    db.execute(
        update(Payment)
        .where(Payment.booking_id == booking_id, Payment.status == PaymentStatus.PENDING)
        .values(status=PaymentStatus.FAILED)
    )


def release_expired_for_ticket_type(db: Session, tt: TicketType, now=None) -> list[Booking]:
    """Free the seats of unpaid reservations whose time ran out. Caller holds the tt lock."""
    now = now or utcnow()
    stale = db.scalars(
        select(Booking)
        .where(Booking.ticket_type_id == tt.id, Booking.status == BookingStatus.PENDING, Booking.expires_at < now)
        .with_for_update()
        .execution_options(populate_existing=True)
    ).all()
    for b in stale:
        b.status = BookingStatus.EXPIRED
        tt.reserved_count = max(0, tt.reserved_count - b.quantity)
        _fail_pending_payments(db, b.id)
    return list(stale)


# ---------------------------------------------------------------- creating a booking
def _find_by_key(db: Session, user_id: str, key: str) -> Booking | None:
    return db.scalar(select(Booking).where(Booking.user_id == user_id, Booking.idempotency_key == key))


def _check_idempotent_match(existing: Booking, ticket_type_id: str, quantity: int) -> None:
    if existing.ticket_type_id != ticket_type_id or existing.quantity != quantity:
        raise _http(status.HTTP_409_CONFLICT, "Idempotency key was already used for a different request")


def create_booking(db: Session, user: User, ticket_type_id: str, quantity: int, idempotency_key: str) -> tuple[Booking, bool]:
    """Returns (booking, created). created=False means an identical earlier request was replayed."""
    if quantity < 1 or quantity > settings.max_tickets_per_booking:
        raise _http(422, f"Quantity must be between 1 and {settings.max_tickets_per_booking}")

    existing = _find_by_key(db, user.id, idempotency_key)
    if existing:
        _check_idempotent_match(existing, ticket_type_id, quantity)
        return existing, False

    now = utcnow()
    tt = lock_ticket_type(db, ticket_type_id)          # <- the database decides the winner here
    event = db.get(Event, tt.event_id)

    if event.status != EventStatus.PUBLISHED:
        raise _http(409, "This event is not open for booking")
    if event.end_time <= now:
        raise _http(409, "This event has already ended")
    if event.registration_deadline and event.registration_deadline < now:
        raise _http(409, "Registration for this event has closed")
    if tt.sales_start and tt.sales_start > now:
        raise _http(409, "Ticket sales have not started yet")
    if tt.sales_end and tt.sales_end < now:
        raise _http(409, "Ticket sales have ended")

    expired = release_expired_for_ticket_type(db, tt, now)

    available = tt.capacity - tt.sold_count - tt.reserved_count
    if available < quantity:
        db.commit() if expired else db.rollback()   # keep the seats freed from expired holds
        raise _http(409, "Sold out" if available <= 0 else f"Only {available} ticket(s) left")

    unit_price = current_price_for(tt)                  # from CONFIRMED sales only
    booking = Booking(
        id=new_uuid(),
        user_id=user.id,
        ticket_type_id=tt.id,
        quantity=quantity,
        unit_price=unit_price,
        total_amount=money(unit_price * quantity),
        status=BookingStatus.PENDING,
        idempotency_key=idempotency_key,
        expires_at=now + timedelta(minutes=settings.reservation_minutes),
    )
    tt.reserved_count += quantity
    db.add(booking)
    try:
        db.flush()
    except IntegrityError:
        # two identical requests raced; the unique (user_id, idempotency_key) let only one in
        db.rollback()
        existing = _find_by_key(db, user.id, idempotency_key)
        if existing:
            _check_idempotent_match(existing, ticket_type_id, quantity)
            return existing, False
        raise

    if booking.total_amount == 0:                       # free event: no payment step
        _confirm_locked(db, booking, tt, event, was_reserved=True)

    db.commit()
    db.refresh(booking)
    return booking, True


# ---------------------------------------------------------------- confirming
def _confirm_locked(db: Session, booking: Booking, tt: TicketType, event: Event, *, was_reserved: bool) -> None:
    """Turn a booking into CONFIRMED and issue tickets. Caller holds the tt + booking locks."""
    tt.sold_count += booking.quantity
    if was_reserved:
        tt.reserved_count = max(0, tt.reserved_count - booking.quantity)
    booking.status = BookingStatus.CONFIRMED
    booking.expires_at = None

    for _ in range(booking.quantity):
        ticket_id = new_uuid()
        db.add(
            Ticket(
                id=ticket_id,
                booking_id=booking.id,
                user_id=booking.user_id,
                ticket_type_id=tt.id,
                qr_token_hash=qr_service.hash_token(qr_service.make_token(ticket_id)),
                status=TicketStatus.ACTIVE,
            )
        )

    old_price = tt.current_price
    if sync_price(db, tt):                              # a 20% milestone was crossed
        notify(
            db, event.organizer_id, "Ticket price increased",
            f"'{tt.name}' for {event.title} is now {money(tt.current_price)} {tt.currency} "
            f"(was {money(old_price)}) after {tt.sold_count} sales.",
            "PRICE_CHANGE",
        )
    notify(
        db, booking.user_id, "Booking confirmed",
        f"{booking.quantity} x {tt.name} for {event.title} is confirmed. Your QR tickets are ready.",
        "BOOKING_CONFIRMED",
    )


def complete_payment(db: Session, payment_id: str, success: bool) -> tuple[Booking, Payment]:
    """Apply a payment result. Idempotent: a payment that already left PENDING is returned untouched."""
    payment = db.get(Payment, payment_id)
    if payment is None:
        raise _http(404, "Payment not found")
    booking = db.get(Booking, payment.booking_id)
    tt = lock_ticket_type(db, booking.ticket_type_id)
    booking = _lock_booking(db, booking.id)
    payment = _lock_payment(db, payment.id)

    if payment.status != PaymentStatus.PENDING:
        db.commit()
        return booking, payment

    if not success:
        payment.status = PaymentStatus.FAILED
        db.commit()
        return booking, payment

    event = db.get(Event, tt.event_id)
    payment.status = PaymentStatus.SUCCESS
    payment.paid_at = utcnow()

    if booking.status == BookingStatus.PENDING:
        _confirm_locked(db, booking, tt, event, was_reserved=True)
    elif booking.status == BookingStatus.EXPIRED:
        # Paid after the hold expired: honour it only if a seat is still free.
        free = tt.capacity - tt.sold_count - tt.reserved_count
        if free >= booking.quantity and event.status == EventStatus.PUBLISHED:
            _confirm_locked(db, booking, tt, event, was_reserved=False)
        else:
            booking.status = BookingStatus.FAILED
            payment.status = PaymentStatus.REFUNDED   # TODO real gateway: trigger the refund here
            notify(db, booking.user_id, "Payment refunded",
                   "Your reservation expired and the tickets sold out, so your payment was refunded.", "REFUND")
    elif booking.status != BookingStatus.CONFIRMED:
        payment.status = PaymentStatus.REFUNDED       # TODO real gateway: trigger the refund here
        db.commit()
        raise _http(409, f"Booking is {booking.status.value}; payment will be refunded")

    db.commit()
    db.refresh(booking)
    return booking, payment


# ---------------------------------------------------------------- cancelling
def cancel_booking(db: Session, user: User, booking_id: str) -> Booking:
    booking = db.get(Booking, booking_id)
    if booking is None or (booking.user_id != user.id and user.role.value != "ADMIN"):
        raise _http(404, "Booking not found")

    tt = lock_ticket_type(db, booking.ticket_type_id)
    booking = _lock_booking(db, booking_id)
    event = db.get(Event, tt.event_id)

    if booking.status == BookingStatus.PENDING:
        booking.status = BookingStatus.CANCELLED
        tt.reserved_count = max(0, tt.reserved_count - booking.quantity)
        _fail_pending_payments(db, booking.id)

    elif booking.status == BookingStatus.CONFIRMED:
        if event.start_time - utcnow() < timedelta(hours=settings.cancel_before_hours):
            raise _http(409, f"Tickets can only be cancelled at least {settings.cancel_before_hours}h before the event")
        tickets = db.scalars(select(Ticket).where(Ticket.booking_id == booking.id).with_for_update()).all()
        if any(t.status == TicketStatus.USED for t in tickets):
            raise _http(409, "Some tickets were already used")
        for t in tickets:
            t.status = TicketStatus.CANCELLED
        tt.sold_count = max(0, tt.sold_count - booking.quantity)
        booking.status = BookingStatus.CANCELLED
        db.execute(
            update(Payment)
            .where(Payment.booking_id == booking.id, Payment.status == PaymentStatus.SUCCESS)
            .values(status=PaymentStatus.REFUNDED)       # TODO real gateway: trigger the refund here
        )
        sync_price(db, tt)                               # price follows sold_count back down
        notify(db, booking.user_id, "Booking cancelled", f"Your booking for {event.title} was cancelled.", "BOOKING_CANCELLED")
    else:
        raise _http(409, f"A {booking.status.value} booking cannot be cancelled")

    db.commit()
    db.refresh(booking)
    return booking


def cancel_event_bookings(db: Session, event: Event) -> None:
    """When an organizer cancels an event: cancel every live booking and ticket, refund payments, notify."""
    affected: list[str] = []
    for tt_id in db.scalars(select(TicketType.id).where(TicketType.event_id == event.id)).all():
        tt = lock_ticket_type(db, tt_id)
        bookings = db.scalars(
            select(Booking)
            .where(Booking.ticket_type_id == tt.id, Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED]))
            .with_for_update()
        ).all()
        for b in bookings:
            b.status = BookingStatus.CANCELLED
            affected.append(b.user_id)
            db.execute(update(Ticket).where(Ticket.booking_id == b.id, Ticket.status == TicketStatus.ACTIVE)
                       .values(status=TicketStatus.CANCELLED))
            db.execute(update(Payment).where(Payment.booking_id == b.id, Payment.status == PaymentStatus.SUCCESS)
                       .values(status=PaymentStatus.REFUNDED))   # TODO real gateway refunds
            _fail_pending_payments(db, b.id)
        tt.reserved_count = 0
        tt.sold_count = 0
    notify_many(db, affected, "Event cancelled", f"{event.title} was cancelled. Any payment will be refunded.", "EVENT_CANCELLED")


# ---------------------------------------------------------------- background expiry
def expire_stale_reservations() -> list[str]:
    """Periodic job: release unpaid holds. Returns the event ids whose availability changed."""
    now = utcnow()
    changed_events: set[str] = set()
    with SessionLocal() as db:
        tt_ids = db.scalars(
            select(Booking.ticket_type_id)
            .where(Booking.status == BookingStatus.PENDING, Booking.expires_at < now)
            .distinct()
        ).all()
    for tt_id in tt_ids:
        with SessionLocal() as db:
            tt = lock_ticket_type(db, tt_id)
            released = release_expired_for_ticket_type(db, tt, now)
            if released:
                changed_events.add(tt.event_id)
                notify_many(db, [b.user_id for b in released], "Reservation expired",
                            "Your ticket reservation expired because payment was not completed.", "RESERVATION_EXPIRED")
            db.commit()
    return list(changed_events)
