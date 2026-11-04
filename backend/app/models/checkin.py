from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.utils.ids import new_uuid


class CheckIn(Base):
    __tablename__ = "check_ins"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    # unique=True is what guarantees one entry per ticket, even with two scanners
    ticket_id: Mapped[str] = mapped_column(
        ForeignKey("tickets.id", ondelete="RESTRICT"), unique=True, nullable=False
    )
    event_id: Mapped[str] = mapped_column(ForeignKey("events.id", ondelete="RESTRICT"))
    verified_by: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    gate_name: Mapped[str | None] = mapped_column(String(100))
    checked_in_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.current_timestamp())
