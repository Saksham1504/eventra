import enum
from datetime import datetime
from decimal import Decimal

from sqlalchemy import CHAR, DateTime, Enum, ForeignKey, Integer, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.utils.ids import new_uuid


class BookingStatus(str, enum.Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    FAILED = "FAILED"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"


class TicketStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    USED = "USED"
    CANCELLED = "CANCELLED"
    REFUNDED = "REFUNDED"


class PaymentStatus(str, enum.Enum):
    PENDING = "PENDING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"


class Booking(Base):
    __tablename__ = "bookings"
    __table_args__ = (UniqueConstraint("user_id", "idempotency_key"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    ticket_type_id: Mapped[str] = mapped_column(ForeignKey("ticket_types.id", ondelete="RESTRICT"))
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[BookingStatus] = mapped_column(Enum(BookingStatus), default=BookingStatus.PENDING)
    idempotency_key: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.current_timestamp())
    expires_at: Mapped[datetime | None] = mapped_column(DateTime)

    tickets: Mapped[list["Ticket"]] = relationship(back_populates="booking")
    payments: Mapped[list["Payment"]] = relationship(back_populates="booking")


class Ticket(Base):
    __tablename__ = "tickets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    booking_id: Mapped[str] = mapped_column(ForeignKey("bookings.id", ondelete="RESTRICT"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    ticket_type_id: Mapped[str] = mapped_column(ForeignKey("ticket_types.id", ondelete="RESTRICT"))
    qr_token_hash: Mapped[str] = mapped_column(CHAR(64), unique=True, nullable=False)
    status: Mapped[TicketStatus] = mapped_column(Enum(TicketStatus), default=TicketStatus.ACTIVE)
    issued_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.current_timestamp())
    used_at: Mapped[datetime | None] = mapped_column(DateTime)

    booking: Mapped["Booking"] = relationship(back_populates="tickets")


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    booking_id: Mapped[str] = mapped_column(ForeignKey("bookings.id", ondelete="RESTRICT"))
    provider: Mapped[str | None] = mapped_column(String(100))
    provider_payment_id: Mapped[str | None] = mapped_column(String(255), unique=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[PaymentStatus] = mapped_column(Enum(PaymentStatus), default=PaymentStatus.PENDING)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.current_timestamp())
    paid_at: Mapped[datetime | None] = mapped_column(DateTime)

    booking: Mapped["Booking"] = relationship(back_populates="payments")
