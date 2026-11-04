"""The real race test. Needs TEST_DATABASE_URL pointing at a MySQL/MariaDB TEST database."""
import threading
import uuid

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.database import SessionLocal
from app.models import Booking, BookingStatus, TicketType, User
from app.services import booking_service
from tests.conftest import IS_MYSQL, H, make_user, setup_event

pytestmark = pytest.mark.skipif(not IS_MYSQL, reason="needs a real MySQL/MariaDB (set TEST_DATABASE_URL)")


def race(tt_id, user_ids, quantity=1, same_key=None):
    results, barrier = [], threading.Barrier(len(user_ids))

    def worker(uid):
        with SessionLocal() as db:
            user = db.get(User, uid)
            barrier.wait()                                   # everyone fires at the same instant
            try:
                b, created = booking_service.create_booking(db, user, tt_id, quantity, same_key or str(uuid.uuid4()))
                results.append(("ok", b.id))
            except HTTPException as e:
                results.append((e.status_code, e.detail))

    threads = [threading.Thread(target=worker, args=(u,)) for u in user_ids]
    [t.start() for t in threads]
    [t.join() for t in threads]
    return results


def test_25_students_race_for_the_last_ticket(client, organizer):
    _, tt = setup_event(client, organizer, capacity=1)
    users = [make_user(name=f"S{i}") for i in range(25)]
    results = race(tt, users)
    assert sum(1 for r in results if r[0] == "ok") == 1
    assert sum(1 for r in results if r[0] == 409) == 24
    with SessionLocal() as db:
        t = db.get(TicketType, tt)
        assert (t.reserved_count, t.sold_count) == (1, 0)
        assert db.scalars(select(Booking).where(Booking.status == BookingStatus.PENDING)).all().__len__() == 1


def test_never_oversells_with_multi_ticket_bookings(client, organizer):
    _, tt = setup_event(client, organizer, capacity=10)
    users = [make_user(name=f"S{i}") for i in range(20)]
    results = race(tt, users, quantity=3)
    winners = sum(1 for r in results if r[0] == "ok")
    assert winners == 3                                       # 3 x 3 = 9 <= 10, a 4th would need 12
    with SessionLocal() as db:
        assert db.get(TicketType, tt).reserved_count == 9


def test_same_idempotency_key_sent_20_times_at_once_makes_one_booking(client, organizer):
    _, tt = setup_event(client, organizer, capacity=5)
    uid = make_user(name="Double clicker")
    results = race(tt, [uid] * 20, quantity=1, same_key="same-key-123456")
    assert all(r[0] == "ok" for r in results) and len({r[1] for r in results}) == 1
    with SessionLocal() as db:
        assert db.get(TicketType, tt).reserved_count == 1


def test_two_scanners_one_ticket(client, organizer):
    from tests.conftest import book_and_pay
    eid, tt = setup_event(client, organizer, capacity=2)
    s = make_user(name="Attendee")
    book_and_pay(client, s, tt)
    token = client.get("/tickets/mine", headers=H(s)).json()[0]["qr_token"]
    out, barrier = [], threading.Barrier(10)

    def scan():
        from fastapi.testclient import TestClient
        from app.main import app
        c = TestClient(app)
        barrier.wait()
        out.append(c.post("/checkin", headers=H(organizer), json={"token": token, "event_id": eid}).json()["result"])

    ts = [threading.Thread(target=scan) for _ in range(10)]
    [t.start() for t in ts]
    [t.join() for t in ts]
    assert out.count("ADMITTED") == 1 and out.count("ALREADY_USED") == 9
