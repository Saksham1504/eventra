import asyncio
import logging
from collections import defaultdict

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """In-memory rooms, one per event. Fine for a single server process."""

    def __init__(self) -> None:
        self.rooms: dict[str, set[WebSocket]] = defaultdict(set)
        self.loop: asyncio.AbstractEventLoop | None = None

    async def connect(self, room: str, ws: WebSocket) -> None:
        await ws.accept()
        self.rooms[room].add(ws)

    def disconnect(self, room: str, ws: WebSocket) -> None:
        self.rooms[room].discard(ws)
        if not self.rooms[room]:
            self.rooms.pop(room, None)

    async def broadcast(self, room: str, data: dict) -> None:
        for ws in list(self.rooms.get(room, ())):
            try:
                await ws.send_json(data)
            except Exception:
                self.disconnect(room, ws)

    def broadcast_threadsafe(self, room: str, data: dict) -> None:
        """Called from normal (sync) endpoints, which run in a worker thread."""
        if self.loop and self.loop.is_running() and self.rooms.get(room):
            asyncio.run_coroutine_threadsafe(self.broadcast(room, data), self.loop)


manager = ConnectionManager()
