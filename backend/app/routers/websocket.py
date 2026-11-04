import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.websocket_manager import manager
from app.database import SessionLocal
from app.services.availability_service import event_snapshot

router = APIRouter(tags=["live"])


def _snapshot(event_id: str) -> dict:
    with SessionLocal() as db:
        return event_snapshot(db, event_id)


@router.websocket("/ws/events/{event_id}")
async def live_event(ws: WebSocket, event_id: str):
    """Public live feed: remaining tickets and current price, pushed whenever a booking changes them."""
    await manager.connect(event_id, ws)
    try:
        await ws.send_json(await asyncio.to_thread(_snapshot, event_id))   # initial state
        while True:
            await ws.receive_text()   # keeps the socket open; clients may send "ping"
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(event_id, ws)
