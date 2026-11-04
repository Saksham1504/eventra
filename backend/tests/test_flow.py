import uuid
from datetime import timedelta

from sqlalchemy import select

from app.database import SessionLocal
from app.models import Booking, BookingStatus, TicketType
from app.services.booking_service import expire_stale_reservations
from app.utils.time import utcnow
from tests.conftest import H, book_and_pay, setup_event


def key():
    return {"Idempotency-Key": str(uuid.uuid4())}


def test_full_happy_path_with_qr_and_checkin(client, organizer, students):
    eid, tt = setup_event(client, organizer, capacity=10, price=100)
    s = students[0]
    booking = book_and_pay(client, s, tt, qty=2)
    assert booking["status"] == "CONFIRMED" and len(booking["ticket_ids"]) == 2

    tickets = client.get("/tickets/mine", headers=H(s)).json()
    assert len(tickets) == 2
    t = tickets[0]
    qr = client.get(f"/tickets/{t['id']}/qr.png", headers=H(s))
    assert qr.status_code == 200 and qr.content[:4] == b"\x89PNG"

    # a different student can't open someone else's ticket
    assert client.get(f"/tickets/{t['id']}", headers=H(students[1])).status_code == 404

    scan = lambda token, ev=eid, user=organizer: client.post(
        "/checkin", headers=H(user), json={"token": token, "event_id": ev}).json()
    assert scan(t["qr_token"])["result"] == "ADMITTED"
    again = scan(t["qr_token"])
    assert again["result"] == "ALREADY_USED" and again["used_at"]
    assert scan("0" * 64)["result"] == "INVALID"

    other_org = client.post("/events", headers=H(organizer), json={
        "title": "Other", "venue": "X", "start_time": "2030-02-01T10:00:00Z", "end_time": "2030-02-01T12:00:00Z"}).json()["id"]
    assert scan(tickets[1]["qr_token"], ev=other_org)["result"] in ("WRONG_EVENT", "EVENT_NOT_ACTIVE")

    stats = client.get(f"/analytics/events/{eid}", headers=H(organizer)).json()
    assert stats["totals"]["tickets_sold"] == 2 and stats["totals"]["checked_in"] == 1
    assert stats["totals"]["revenue"] == 200.0


def test_last_ticket_only_one_winner(client, organizer, students):
    _, tt = setup_event(client, organizer, capacity=1)
    a = client.post("/bookings", headers=H(students[0], **key()), json={"ticket_type_id": tt})
    b = client.post("/bookings", headers=H(students[1], **key()), json={"ticket_type_id": tt})
    assert (a.status_code, b.status_code) == (201, 409)
    assert b.json()["detail"] == "Sold out"


def test_idempotent_retry_returns_same_booking(client, organizer, students):
    _, tt = setup_event(client, organizer, capacity=5)
    h = H(students[0], **key())
    r1 = client.post("/bookings", headers=h, json={"ticket_type_id": tt, "quantity": 2})
    r2 = client.post("/bookings", headers=h, json={"ticket_type_id": tt, "quantity": 2})
    assert r1.status_code == 201 and r2.status_code == 200 and r1.json()["id"] == r2.json()["id"]
    with SessionLocal() as db:
        assert db.get(TicketType, tt).reserved_count == 2          # not 4
    # same key, different request -> rejected
    r3 = client.post("/bookings", headers=h, json={"ticket_type_id": tt, "quantity": 3})
    assert r3.status_code == 409


def test_price_steps_up_with_confirmed_sales_only(client, organizer, students):
    _, tt = setup_event(client, organizer, capacity=10, price=100)   # a step every 2 tickets
    price = lambda: client.get(f"/ticket-types/{tt}/pricing").json()["ticket_type"]["current_price"]
    assert price() == 100
    # a pending (unpaid) booking must NOT move the price
    client.post("/bookings", headers=H(students[0], **key()), json={"ticket_type_id": tt, "quantity": 2})
    assert price() == 100
    book_and_pay(client, students[1], tt, qty=1)
    assert price() == 100
    book_and_pay(client, students[2], tt, qty=1)                     # 2 confirmed sold
    assert price() == 125
    info = client.get(f"/ticket-types/{tt}/pricing").json()
    assert [h["new_price"] for h in info["history"]] == [125.0]
    assert info["ticket_type"]["next_price"] == 156.25


def test_expired_reservation_frees_the_seat(client, organizer, students):
    _, tt = setup_event(client, organizer, capacity=1)
    r = client.post("/bookings", headers=H(students[0], **key()), json={"ticket_type_id": tt})
    assert r.status_code == 201
    assert client.post("/bookings", headers=H(students[1], **key()), json={"ticket_type_id": tt}).status_code == 409
    with SessionLocal() as db:                                       # pretend 20 minutes passed
        b = db.scalar(select(Booking))
        b.expires_at = utcnow() - timedelta(minutes=20)
        db.commit()
    assert expire_stale_reservations()                               # job releases it
    with SessionLocal() as db:
        assert db.scalar(select(Booking)).status == BookingStatus.EXPIRED
        assert db.get(TicketType, tt).reserved_count == 0
    assert client.post("/bookings", headers=H(students[1], **key()), json={"ticket_type_id": tt}).status_code == 201


def test_cancel_confirmed_booking_releases_capacity_and_price(client, organizer, students):
    _, tt = setup_event(client, organizer, capacity=10, price=100)
    b = book_and_pay(client, students[0], tt, qty=2)
    assert client.get(f"/ticket-types/{tt}/pricing").json()["ticket_type"]["current_price"] == 125
    r = client.post(f"/bookings/{b['id']}/cancel", headers=H(students[0]))
    assert r.status_code == 200 and r.json()["status"] == "CANCELLED"
    info = client.get(f"/ticket-types/{tt}/pricing").json()["ticket_type"]
    assert info["sold_count"] == 0 and info["available"] == 10 and info["current_price"] == 100
    toks = client.get("/tickets/mine", headers=H(students[0])).json()
    assert all(t["status"] == "CANCELLED" for t in toks)


def test_free_event_confirms_immediately(client, organizer, students):
    _, tt = setup_event(client, organizer, capacity=3, price=0)
    r = client.post("/bookings", headers=H(students[0], **key()), json={"ticket_type_id": tt})
    assert r.status_code == 201 and r.json()["status"] == "CONFIRMED" and len(r.json()["ticket_ids"]) == 1


def test_permissions_and_draft_visibility(client, organizer, students, admin):
    eid, tt = setup_event(client, organizer, publish=False)
    assert client.get(f"/events/{eid}").status_code == 404                     # draft hidden from public
    assert client.get(f"/events/{eid}", headers=H(organizer)).status_code == 200
    assert client.post("/bookings", headers=H(students[0], **key()), json={"ticket_type_id": tt}).status_code == 409
    assert client.post("/events", headers=H(students[0]), json={}).status_code == 403   # students can't create events
    assert client.get("/admin/stats", headers=H(students[0])).status_code == 403
    assert client.get("/admin/stats", headers=H(admin)).status_code == 200


def test_capacity_cannot_drop_below_sold(client, organizer, students):
    _, tt = setup_event(client, organizer, capacity=10)
    book_and_pay(client, students[0], tt, qty=3)
    assert client.patch(f"/ticket-types/{tt}", headers=H(organizer), json={"capacity": 2}).status_code == 409
    assert client.patch(f"/ticket-types/{tt}", headers=H(organizer), json={"base_price": 50}).status_code == 409
    assert client.patch(f"/ticket-types/{tt}", headers=H(organizer), json={"capacity": 20}).status_code == 200


def test_websocket_sends_live_snapshot(client, organizer, students):
    eid, tt = setup_event(client, organizer, capacity=5, price=100)
    with client.websocket_connect(f"/ws/events/{eid}") as ws:
        snap = ws.receive_json()
    t = snap["ticket_types"][0]
    assert snap["event_id"] == eid and t["available"] == 5 and t["current_price"] == 100
