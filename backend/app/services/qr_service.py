"""Feature 3 helpers: ticket QR tokens.

token      = HMAC-SHA256(QR_SECRET, ticket_id)   -> what is inside the QR code
stored     = SHA-256(token)                      -> tickets.qr_token_hash
The token can be re-derived from the ticket id, so students can open their QR any time,
while the database never stores a usable token.
"""
import hashlib
import hmac
import io

import qrcode

from app.config import settings


def make_token(ticket_id: str) -> str:
    return hmac.new(settings.qr_secret.encode(), ticket_id.encode(), hashlib.sha256).hexdigest()


def hash_token(token: str) -> str:
    return hashlib.sha256(token.strip().lower().encode()).hexdigest()


def qr_png(token: str) -> bytes:
    img = qrcode.make(token, box_size=8, border=2)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()
