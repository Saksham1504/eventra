"""Tests run against TEST_DATABASE_URL (a throwaway MySQL/MariaDB database) or, by default, SQLite.
NEVER point TEST_DATABASE_URL at your real eventra database: the tests drop and recreate all tables."""
import os
import uuid

TEST_DB = os.environ.get("TEST_DATABASE_URL", "sqlite:///./test_eventra.db")
os.environ["DATABASE_URL"] = TEST_DB
os.environ.setdefault("QR_SECRET", "test-secret")

import pytest
from fastapi import Depends, Request
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.dependencies import get_current_user, get_optional_user
from app.database import Base, DbSession, SessionLocal, engine
from app.main import app
from app.models import OrganizerProfile, User, UserRole, VerificationStatus

IS_MYSQL = TEST_DB.startswith("mysql")


def _fake_user(request: Request, db: DbSession):
    uid = request.headers.get("X-Test-User")
    return db.get(User, uid) if uid else None


def _fake_current(request: Request, db: DbSession):
    from fastapi import HTTPException
    user = _fake_user(request, db)
    if user is None:
        raise HTTPException(401, "not logged in")
    return user


app.dependency_overrides[get_current_user] = _fake_current
app.dependency_overrides[get_optional_user] = _fake_user


def _load_real_schema():
    """Use the project's own schema.sql (real CHECK constraints) instead of the ORM-generated tables."""
    from sqlalchemy import text
    raw = open(os.path.join(os.path.dirname(__file__), "..", "schema.sql")).read()
    sql = "\n".join(line for line in raw.splitlines() if not line.strip().startswith("--"))
    stmts = [x.strip() for x in sql.split(";") if x.strip() and not x.strip().upper().startswith(("CREATE DATABASE", "USE "))]
    with engine.begin() as conn:
        conn.execute(text("SET FOREIGN_KEY_CHECKS=0"))
        for t in conn.execute(text("SHOW TABLES")).scalars().all():
            conn.execute(text(f"DROP TABLE IF EXISTS `{t}`"))
        conn.execute(text("SET FOREIGN_KEY_CHECKS=1"))
        for st in stmts:
            conn.execute(text(st))


@pytest.fixture(autouse=True)
def fresh_db():
    if IS_MYSQL and os.environ.get("USE_SCHEMA_SQL"):
        _load_real_schema()
    else:
        Base.metadata.drop_all(engine)
        Base.metadata.create_all(engine)
    yield


@pytest.fixture
def client():
    return TestClient(app)  # no `with`: skips firebase init + background loop


def make_user(role=UserRole.STUDENT, name="User", approved=False) -> str:
    with SessionLocal() as db:
        u = User(google_uid=f"g-{uuid.uuid4()}", name=name, email=f"{uuid.uuid4()}@t.test", role=role)
        db.add(u)
        db.flush()
        if approved:
            db.add(OrganizerProfile(user_id=u.id, club_name="Club", verification_status=VerificationStatus.APPROVED))
        db.commit()
        return u.id


def H(user_id: str, **extra) -> dict:
    return {"X-Test-User": user_id, **extra}


@pytest.fixture
def organizer():
    return make_user(UserRole.ORGANIZER, "Org", approved=True)


@pytest.fixture
def admin():
    return make_user(UserRole.ADMIN, "Admin")


@pytest.fixture
def students():
    return [make_user(name=f"Student{i}") for i in range(30)]


def setup_event(client, organizer, *, capacity=100, price=100, publish=True, **tt_extra):
    """Create a published event with one ticket type. Returns (event_id, ticket_type_id)."""
    ev = client.post("/events", headers=H(organizer), json={
        "title": "Tech Fest", "venue": "Auditorium", "category": "Tech",
        "start_time": "2030-01-10T10:00:00Z", "end_time": "2030-01-10T18:00:00Z",
    })
    assert ev.status_code == 201, ev.text
    eid = ev.json()["id"]
    tt = client.post(f"/events/{eid}/ticket-types", headers=H(organizer),
                     json={"name": "General", "capacity": capacity, "base_price": price, **tt_extra})
    assert tt.status_code == 201, tt.text
    if publish:
        assert client.post(f"/events/{eid}/publish", headers=H(organizer)).status_code == 200
    return eid, tt.json()["id"]


def book_and_pay(client, student, tt_id, qty=1):
    r = client.post("/bookings", headers=H(student, **{"Idempotency-Key": str(uuid.uuid4())}),
                    json={"ticket_type_id": tt_id, "quantity": qty})
    assert r.status_code == 201, r.text
    bid = r.json()["id"]
    p = client.post("/payments/checkout", headers=H(student), json={"booking_id": bid})
    assert p.status_code == 201, p.text
    c = client.post(f"/payments/{p.json()['id']}/mock-confirm", headers=H(student))
    assert c.status_code == 200, c.text
    return c.json()["booking"]
