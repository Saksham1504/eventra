from collections.abc import Generator
from typing import Annotated

from fastapi import Depends
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

_engine_kwargs: dict = {"pool_pre_ping": True, "future": True}
if settings.database_url.startswith("mysql"):
    _engine_kwargs.update(
        pool_recycle=3600,
        pool_size=10,
        max_overflow=20,
        # READ COMMITTED avoids stale snapshots and gap-lock deadlocks in booking transactions
        isolation_level="READ COMMITTED",
    )
else:  # sqlite, used only for local tests
    _engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(settings.database_url, **_engine_kwargs)

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


DbSession = Annotated[Session, Depends(get_db)]
