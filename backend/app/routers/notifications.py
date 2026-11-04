from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, select, update

from app.core.dependencies import CurrentUser
from app.database import DbSession
from app.models import Notification
from app.schemas.misc import NotificationOut

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationOut])
def list_notifications(user: CurrentUser, db: DbSession, unread_only: bool = False,
                       limit: int = Query(30, ge=1, le=100), offset: int = Query(0, ge=0)):
    stmt = select(Notification).where(Notification.user_id == user.id)
    if unread_only:
        stmt = stmt.where(Notification.is_read.is_(False))
    return db.scalars(stmt.order_by(Notification.created_at.desc()).limit(limit).offset(offset)).all()


@router.get("/unread-count")
def unread_count(user: CurrentUser, db: DbSession):
    n = db.scalar(select(func.count()).select_from(Notification).where(
        Notification.user_id == user.id, Notification.is_read.is_(False)))
    return {"unread": n or 0}


@router.post("/read-all")
def read_all(user: CurrentUser, db: DbSession):
    db.execute(update(Notification).where(Notification.user_id == user.id).values(is_read=True))
    db.commit()
    return {"ok": True}


@router.post("/{notification_id}/read", response_model=NotificationOut)
def mark_read(notification_id: str, user: CurrentUser, db: DbSession):
    n = db.get(Notification, notification_id)
    if n is None or n.user_id != user.id:
        raise HTTPException(404, "Notification not found")
    n.is_read = True
    db.commit()
    return n
