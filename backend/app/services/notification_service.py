from collections.abc import Iterable

from sqlalchemy.orm import Session

from app.models import Notification


def notify(db: Session, user_id: str, title: str, message: str, type_: str = "INFO") -> None:
    db.add(Notification(user_id=user_id, title=title, message=message, type=type_))


def notify_many(db: Session, user_ids: Iterable[str], title: str, message: str, type_: str = "INFO") -> None:
    for uid in set(user_ids):
        notify(db, uid, title, message, type_)
