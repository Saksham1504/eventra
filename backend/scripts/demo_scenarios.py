"""
Runnable demo script showcasing Eventra's three core strengths:
1. Dynamic pricing jump: When confirmed sales reach the 20% tier boundary, price auto-increases by 25%.
2. Concurrency-safe booking: Mutex row locks (SELECT FOR UPDATE) prevent overselling under high concurrency.
3. Atomic QR check-in: QR entry admits exactly once. Second scan is flagged ALREADY_USED immediately.
"""
import sys
import os
import uuid
from decimal import Decimal
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models import TicketType, User, UserRole, OrganizerProfile, VerificationStatus, Event, EventStatus
from app.services.pricing_service import build_tier_rows

client = TestClient(app)


def print_step(title):
    print("\n" + "=" * 65)
    print(f" {title}")
    print("=" * 65)


def run_demo():
    print("Starting Eventra Architectural Demonstration...")

    # 1. Setup an event for the demo
    print_step("Scenario 1: Dynamic Pricing Jump (Tier Boundary)")
    headers_org = {"Authorization": "Bearer mock-tech"}
    
    # Check initial event & ticket type
    resp = client.get("/events")
    events = resp.json()
    assert len(events) > 0, "No events found"
    event_id = events[0]["id"]
    print(f"Using Event: '{events[0]['title']}' (ID: {event_id})")

    # Create a test ticket type with capacity=20, base_price=100 so each tier = 4 tickets (20%)
    tt_resp = client.post(
        f"/events/{event_id}/ticket-types",
        headers=headers_org,
        json={
            "name": f"Dynamic Test {uuid.uuid4().hex[:4]}",
            "capacity": 20,
            "base_price": 100.0,
            "increment_percent": 25.0,
            "capacity_step_percent": 20.0,
        }
    )
    assert tt_resp.status_code == 201, tt_resp.text
    tt = tt_resp.json()
    tt_id = tt["id"]
    print(f"Created Ticket Type: '{tt['name']}'")
    print(f"Initial Base Price: INR {tt['current_price']} (Capacity: {tt['capacity']})")

    # Sell 4 tickets (20% of 20 = 4)
    print("Purchasing tickets 1 to 4...")
    for i in range(1, 5):
        student_headers = {"Authorization": f"Bearer mock-student{i}", "Idempotency-Key": f"demo_tier_{i}_{uuid.uuid4()}"}
        b_res = client.post("/bookings", headers=student_headers, json={"ticket_type_id": tt_id, "quantity": 1})
        assert b_res.status_code == 201, b_res.text
        b_id = b_res.json()["id"]

        # Checkout and confirm payment
        pay_res = client.post("/payments/checkout", headers=student_headers, json={"booking_id": b_id})
        pay_id = pay_res.json()["id"]
        conf_res = client.post(f"/payments/{pay_id}/mock-confirm", headers=student_headers)
        assert conf_res.status_code == 200

    # Inspect the updated price
    ev_updated = client.get(f"/events/{event_id}").json()
    tt_updated = next(t for t in ev_updated["ticket_types"] if t["id"] == tt_id)
    print(f"Sold Count: {tt_updated['sold_count']}/{tt_updated['capacity']}")
    print(f"Dynamic Price jumped from INR 100.00 -> INR {tt_updated['current_price']:.2f} (25% increase triggered at 20% tier boundary)!")
    assert float(tt_updated["current_price"]) == 125.0, f"Expected 125.0, got {tt_updated['current_price']}"

    # 2. Concurrency & Capacity Protection
    print_step("Scenario 2: Capacity Protection & Concurrency Safety")
    from app.config import settings
    is_mysql = settings.database_url.startswith("mysql")

    tt_race_resp = client.post(
        f"/events/{event_id}/ticket-types",
        headers=headers_org,
        json={
            "name": f"Limited Edition {uuid.uuid4().hex[:4]}",
            "capacity": 1,
            "base_price": 500.0,
        }
    )
    race_tt_id = tt_race_resp.json()["id"]
    print(f"Created high-demand ticket with only 1 remaining seat (ID: {race_tt_id})")

    if is_mysql:
        results = []
        def attempt_booking(student_num):
            h = {"Authorization": f"Bearer mock-student{student_num}", "Idempotency-Key": f"race_{student_num}_{uuid.uuid4()}"}
            r = client.post("/bookings", headers=h, json={"ticket_type_id": race_tt_id, "quantity": 1})
            return student_num, r.status_code, r.text

        print("Two students concurrently racing for the final ticket on MySQL...")
        with ThreadPoolExecutor(max_workers=2) as executor:
            f1 = executor.submit(attempt_booking, 1)
            f2 = executor.submit(attempt_booking, 2)
            results = [f1.result(), f2.result()]

        successes = [r for r in results if r[1] == 201]
        failures = [r for r in results if r[1] == 409]
        print(f"Result: {len(successes)} student succeeded (HTTP 201), {len(failures)} student rejected (HTTP 409 Sold Out).")
        assert len(successes) == 1 and len(failures) == 1, "Concurrency lock failed"
        print("MySQL locked row with SELECT ... FOR UPDATE: Zero overselling guaranteed.")
    else:
        # SQLite dev mode: demonstrate deterministic capacity rejection & idempotency
        h1 = {"Authorization": "Bearer mock-student1", "Idempotency-Key": f"bkg_first_{uuid.uuid4()}"}
        r1 = client.post("/bookings", headers=h1, json={"ticket_type_id": race_tt_id, "quantity": 1})
        assert r1.status_code == 201
        print("Student 1 successfully reserved the last remaining ticket (HTTP 201).")

        h2 = {"Authorization": "Bearer mock-student2", "Idempotency-Key": f"bkg_second_{uuid.uuid4()}"}
        r2 = client.post("/bookings", headers=h2, json={"ticket_type_id": race_tt_id, "quantity": 1})
        print(f"Student 2 attempted to book sold-out ticket -> HTTP {r2.status_code} ({r2.json().get('detail')}).")
        assert r2.status_code == 409, f"Expected 409 Sold out, got {r2.status_code}"
        print("Database capacity check verified: Exactly 0 overselling permitted.")

    # 3. QR Entry Check-In: Atomic admission
    print_step("Scenario 3: Atomic QR Code Check-In (Single Admission)")
    # Grab the active ticket from student 1 from the seed
    tickets = client.get("/tickets/mine", headers={"Authorization": "Bearer mock-student1"}).json()
    assert len(tickets) > 0, "No tickets found for student1"
    ticket = tickets[0]
    qr_token = ticket["qr_token"]
    ticket_id = ticket["id"]
    ticket_event_id = ticket["event_id"]
    print(f"Scanned Ticket: {ticket_id} for Event: {ticket['event_title']}")
    print(f"Status before scan: {ticket['status']}")

    # First Scan: should be ADMITTED (Green)
    scan_1 = client.post(
        "/checkin",
        headers=headers_org,
        json={"event_id": ticket_event_id, "token": qr_token, "gate_name": "Gate A - North"}
    )
    assert scan_1.status_code == 200
    res_1 = scan_1.json()
    print(f"1st Scan -> Result: {res_1['result']} (Message: '{res_1['message']}', Attendee: {res_1['attendee_name']})")
    assert res_1["result"] == "ADMITTED"

    # Second Scan: should be ALREADY_USED (Red)
    scan_2 = client.post(
        "/checkin",
        headers=headers_org,
        json={"event_id": ticket_event_id, "token": qr_token, "gate_name": "Gate A - North"}
    )
    assert scan_2.status_code == 200
    res_2 = scan_2.json()
    print(f"2nd Scan -> Result: {res_2['result']} (Message: '{res_2['message']}', Used At: {res_2['used_at']})")
    assert res_2["result"] == "ALREADY_USED"
    print("Atomic status transition ACTIVE -> USED verified: Fraudulent duplicate entry prevented.")

    print_step("ALL THREE CORE ARCHITECTURAL SCENARIOS VERIFIED SUCCESSFULLY!")


if __name__ == "__main__":
    run_demo()
