import enum
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.utils.ids import new_uuid


class EventStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    CANCELLED = "CANCELLED"
    COMPLETED = "COMPLETED"


class Event(Base):
    __tablename__ = "events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    organizer_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(String(100))
    banner_url: Mapped[str | None] = mapped_column(Text)
    venue: Mapped[str] = mapped_column(String(255), nullable=False)
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    registration_deadline: Mapped[datetime | None] = mapped_column(DateTime)
    status: Mapped[EventStatus] = mapped_column(Enum(EventStatus), default=EventStatus.DRAFT)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.current_timestamp())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.current_timestamp(), onupdate=func.current_timestamp()
    )

    organizer: Mapped["User"] = relationship()  # noqa: F821
    ticket_types: Mapped[list["TicketType"]] = relationship(back_populates="event")


class TicketType(Base):
    __tablename__ = "ticket_types"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    event_id: Mapped[str] = mapped_column(ForeignKey("events.id", ondelete="RESTRICT"))
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    sold_count: Mapped[int] = mapped_column(Integer, default=0)
    reserved_count: Mapped[int] = mapped_column(Integer, default=0)
    base_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    current_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    increment_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("25.00"))
    capacity_step_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("20.00"))
    currency: Mapped[str] = mapped_column(String(10), default="INR")
    sales_start: Mapped[datetime | None] = mapped_column(DateTime)
    sales_end: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.current_timestamp())

    event: Mapped["Event"] = relationship(back_populates="ticket_types")
    pricing_tiers: Mapped[list["PricingTier"]] = relationship(back_populates="ticket_type")


class PricingTier(Base):
    __tablename__ = "pricing_tiers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    ticket_type_id: Mapped[str] = mapped_column(ForeignKey("ticket_types.id", ondelete="RESTRICT"))
    tier_number: Mapped[int] = mapped_column(Integer, nullable=False)
    min_sold_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    price_multiplier: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    ticket_type: Mapped["TicketType"] = relationship(back_populates="pricing_tiers")


class PriceHistory(Base):
    __tablename__ = "price_history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    ticket_type_id: Mapped[str] = mapped_column(ForeignKey("ticket_types.id", ondelete="RESTRICT"))
    old_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    new_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    sold_count: Mapped[int] = mapped_column(Integer, nullable=False)
    tier_number: Mapped[int] = mapped_column(Integer, nullable=False)
    changed_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.current_timestamp())
