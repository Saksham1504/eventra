import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.core.security import init_firebase
from app.core.websocket_manager import manager
from app.routers import (
    admin, analytics, auth, bookings, checkin, events, health, notifications,
    payments, ticket_types, tickets, users, websocket,
)
from app.services.availability_service import notify_event_changed
from app.services.booking_service import expire_stale_reservations
from app.services.event_service import complete_ended_events

logger = logging.getLogger(__name__)


async def _expiry_loop() -> None:
    """Every minute: release seats held by unpaid reservations and complete past events."""
    while True:
        try:
            for event_id in await asyncio.to_thread(expire_stale_reservations):
                await asyncio.to_thread(notify_event_changed, event_id)
            await asyncio.to_thread(complete_ended_events)
        except Exception:
            logger.exception("Background maintenance loop encountered an error")
        await asyncio.sleep(settings.expiry_job_interval_seconds)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_firebase()
    manager.loop = asyncio.get_running_loop()
    task = asyncio.create_task(_expiry_loop())
    yield
    task.cancel()


app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (health, auth, users, events, ticket_types, bookings, payments, tickets,
          checkin, notifications, analytics, admin, websocket):
    app.include_router(r.router)
