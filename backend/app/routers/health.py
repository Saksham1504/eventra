from fastapi import APIRouter
from sqlalchemy import text

from app.database import DbSession

router = APIRouter(tags=["health"])


@router.get("/health")
def health(db: DbSession):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "up"}
    except Exception:
        return {"status": "degraded", "database": "down"}
