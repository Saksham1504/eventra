# Eventra Backend

FastAPI + SQLAlchemy + MySQL 8, Firebase Google auth.

## Setup
```
python -m venv venv
source venv/bin/activate            # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                # fill in DATABASE_URL, ADMIN_EMAILS, QR_SECRET ...
```
Put the Firebase service-account JSON at the path in `FIREBASE_CREDENTIALS_PATH`.
The database schema is in `schema.sql` (already applied to your `eventra` database).

## Run
```
uvicorn app.main:app --reload
```
Docs: http://localhost:8000/docs

## Tests
```
pip install -r requirements-dev.txt
pytest                                   # SQLite, fast (race tests are skipped)
# Full suite incl. real concurrency tests, on a THROWAWAY MySQL database (it drops/recreates tables!):
TEST_DATABASE_URL="mysql+pymysql://user:pass@localhost/eventra_test" USE_SCHEMA_SQL=1 pytest
```

## How the three core features work
1. **Dynamic pricing** (`services/pricing_service.py`): price = base x 1.25^tier, tier = floor(confirmed_sold / (capacity x 20%)). Only confirmed sales count. Currency rounding: 2 decimals, half-up.
2. **Concurrency-safe booking** (`services/booking_service.py`): every change to capacity takes `SELECT ... FOR UPDATE` on the ticket_types row. Unique `(user_id, Idempotency-Key)` makes retries safe. Unpaid holds expire after `RESERVATION_MINUTES`.
3. **QR entry** (`routers/checkin.py`): the QR holds an HMAC token; only its SHA-256 is stored. Check-in flips ACTIVE -> USED in a single atomic UPDATE, so a ticket admits exactly once.

## Main flow (frontend)
1. `POST /auth/login` after Google sign-in
2. `GET /events` -> `GET /events/{id}` (live updates: `ws://.../ws/events/{id}`)
3. `POST /bookings` with header `Idempotency-Key: <uuid>`; returns a PENDING booking with `expires_at`
4. `POST /payments/checkout` then `POST /payments/{id}/mock-confirm` (dev) -> booking CONFIRMED, tickets issued
5. `GET /tickets/mine` (each has `qr_token`) or `GET /tickets/{id}/qr.png`
6. Organizer scans: `POST /checkin {token, event_id}`

Note: `/tickets/{id}/qr.png` needs the Authorization header, so load it with fetch() and a blob URL
(a plain <img src> can't send the token), or render `qr_token` with a QR library on the frontend.

## Dates
Send ISO datetimes (ideally with `Z` or an offset). Stored as UTC, returned as ISO with `Z`.

## Not built yet
Real payment gateway (Razorpay webhook), email delivery for notifications, rate limiting,
Redis for WebSocket fan-out across multiple server processes, recommendations / attendance prediction.
