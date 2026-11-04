import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.websocket_manager import manager
from app.database import SessionLocal
from app.models import TicketType
from app.services.serializers import ticket_type_out

logger = logging.getLogger(__name__)


def event_snapshot(db: Session, event_id: str) -> dict:
    tts = db.scalars(select(TicketType).where(TicketType.event_id == event_id).order_by(TicketType.created_at)).all()
    return {
        "event_id": event_id,
        "ticket_types": [ticket_type_out(t).model_dump(mode="json") for t in tts],
    }


def notify_event_changed(event_id: str) -> None:
    """Push fresh availability + prices to everyone watching this event. Never raises."""
    try:
        with SessionLocal() as db:
            manager.broadcast_threadsafe(event_id, event_snapshot(db, event_id))
    except Exception:
        logger.exception("Failed to broadcast availability for event %s", event_id)
