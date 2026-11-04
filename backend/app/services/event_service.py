import logging
from sqlalchemy import select, update
from app.database import SessionLocal
from app.models.event import Event, EventStatus
from app.utils.time import utcnow

logger = logging.getLogger(__name__)


def complete_ended_events() -> int:
    """Finds all PUBLISHED events whose end_time has passed and marks them COMPLETED."""
    now = utcnow()
    with SessionLocal() as db:
        result = db.execute(
            update(Event)
            .where(Event.status == EventStatus.PUBLISHED, Event.end_time < now)
            .values(status=EventStatus.COMPLETED)
        )
        count = result.rowcount
        if count > 0:
            db.commit()
            logger.info("Marked %d ended event(s) as COMPLETED", count)
        return count
