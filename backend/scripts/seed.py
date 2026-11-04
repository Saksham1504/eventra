import os
import sys
from datetime import datetime, timedelta
from decimal import Decimal

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import Base, SessionLocal, engine
from app.models import (
    College, User, UserRole, OrganizerProfile, VerificationStatus,
    Event, EventStatus, TicketType, PricingTier, Booking, BookingStatus,
    Ticket, TicketStatus, Payment, PaymentStatus, Notification
)
from app.services.pricing_service import build_tier_rows
from app.services.qr_service import make_token, hash_token
from app.utils.ids import new_uuid
from app.utils.time import utcnow


def seed():
    print("Initializing database tables...")
    Base.metadata.create_all(engine)

    with SessionLocal() as db:
        # Check if already seeded
        existing_colleges = db.query(College).count()
        if existing_colleges > 0:
            print(f"Database already contains {existing_colleges} colleges. Proceeding with upsert / fresh checks.")

        print("1. Seeding Colleges...")
        colleges = [
            College(id="col_dtu", name="Delhi Technological University (DTU)", location="Delhi, India"),
            College(id="col_iitd", name="Indian Institute of Technology Delhi (IITD)", location="New Delhi, India"),
            College(id="col_nsut", name="Netaji Subhas University of Technology (NSUT)", location="Dwarka, Delhi"),
            College(id="col_iiitd", name="Indraprastha Institute of Information Technology (IIITD)", location="Okhla, Delhi"),
        ]
        for col in colleges:
            if not db.get(College, col.id):
                db.add(col)
        db.commit()

        print("2. Seeding Users...")
        # Admin
        admin = db.query(User).filter_by(email="admin@eventra.local").first()
        if not admin:
            admin = User(
                id="usr_admin",
                google_uid="uid_mock-admin",
                name="System Administrator",
                email="admin@eventra.local",
                role=UserRole.ADMIN,
                college_id="col_dtu"
            )
            db.add(admin)

        # Approved Organizer 1: Tech Society
        org1_user = db.query(User).filter_by(email="tech@eventra.local").first()
        if not org1_user:
            org1_user = User(
                id="usr_org1",
                google_uid="uid_mock-tech",
                name="ACM Student Chapter",
                email="tech@eventra.local",
                role=UserRole.ORGANIZER,
                college_id="col_dtu"
            )
            db.add(org1_user)
            db.flush()
            db.add(OrganizerProfile(
                id=new_uuid(),
                user_id=org1_user.id,
                club_name="ACM Student Chapter",
                description="Official computing and hackathon society.",
                verification_status=VerificationStatus.APPROVED
            ))

        # Approved Organizer 2: Cultural Society
        org2_user = db.query(User).filter_by(email="cult@eventra.local").first()
        if not org2_user:
            org2_user = User(
                id="usr_org2",
                google_uid="uid_mock-cult",
                name="Campus Music & Arts Society",
                email="cult@eventra.local",
                role=UserRole.ORGANIZER,
                college_id="col_iitd"
            )
            db.add(org2_user)
            db.flush()
            db.add(OrganizerProfile(
                id=new_uuid(),
                user_id=org2_user.id,
                club_name="Campus Music & Arts Society",
                description="Organizers of inter-college cultural events and live music fests.",
                verification_status=VerificationStatus.APPROVED
            ))

        # Pending Organizer: Robotics Club
        org3_user = db.query(User).filter_by(email="robotics@eventra.local").first()
        if not org3_user:
            org3_user = User(
                id="usr_org3",
                google_uid="uid_mock-robotics",
                name="Robotics Club Lead",
                email="robotics@eventra.local",
                role=UserRole.ORGANIZER,
                college_id="col_nsut"
            )
            db.add(org3_user)
            db.flush()
            db.add(OrganizerProfile(
                id=new_uuid(),
                user_id=org3_user.id,
                club_name="Robotics & Autonomous Systems Club",
                description="Seeking approval to host the annual National RoboWars arena.",
                verification_status=VerificationStatus.PENDING
            ))

        # Students
        students = []
        for i in range(1, 6):
            s_email = f"student{i}@eventra.local"
            stu = db.query(User).filter_by(email=s_email).first()
            if not stu:
                stu = User(
                    id=f"usr_stu{i}",
                    google_uid=f"uid_mock-student{i}",
                    name=f"Student {i}",
                    email=s_email,
                    role=UserRole.STUDENT,
                    college_id="col_dtu"
                )
                db.add(stu)
            students.append(stu)

        db.commit()

        print("3. Seeding Events & Ticket Types...")
        now = utcnow()
        # Event 1: Tech Hackathon
        ev1 = db.query(Event).filter_by(title="HackPulse 2026: Campus 36H Hackathon").first()
        if not ev1:
            ev1 = Event(
                id="ev_hackpulse_2026",
                organizer_id=org1_user.id,
                title="HackPulse 2026: Campus 36H Hackathon",
                description="36 hours of non-stop building, mentoring, and prizes worth 2 Lakhs. Teams from across colleges compete in Web3, AI, and IoT tracks.",
                category="Tech",
                venue="BR Ambedkar Auditorium & Tech Labs",
                start_time=now + timedelta(days=5),
                end_time=now + timedelta(days=7),
                status=EventStatus.PUBLISHED,
                banner_url="https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=80"
            )
            db.add(ev1)
            db.flush()

            tt1 = TicketType(
                id="tt_hack_solo",
                event_id=ev1.id,
                name="Solo Hacker Pass",
                capacity=100,
                sold_count=0,
                reserved_count=0,
                base_price=Decimal("150.00"),
                current_price=Decimal("150.00"),
                increment_percent=Decimal("25.00"),
                capacity_step_percent=Decimal("20.00"),
                currency="INR"
            )
            db.add(tt1)
            for tier in build_tier_rows(tt1):
                db.add(tier)

            tt2 = TicketType(
                id="tt_hack_squad",
                event_id=ev1.id,
                name="Team Pass (4 Members)",
                capacity=30,
                sold_count=0,
                reserved_count=0,
                base_price=Decimal("500.00"),
                current_price=Decimal("500.00"),
                increment_percent=Decimal("25.00"),
                capacity_step_percent=Decimal("20.00"),
                currency="INR"
            )
            db.add(tt2)
            for tier in build_tier_rows(tt2):
                db.add(tier)

        # Event 2: Music Festival
        ev2 = db.query(Event).filter_by(title="Echoes 2026: Campus Music Fest").first()
        if not ev2:
            ev2 = Event(
                id="ev_echoes_2026",
                organizer_id=org2_user.id,
                title="Echoes 2026: Campus Music Fest",
                description="Live indie bands, DJ night, campus food stalls, and an evening under the stars. Free student glow bands at the entry gate.",
                category="Cultural",
                venue="Open Air Theatre (OAT)",
                start_time=now + timedelta(days=12),
                end_time=now + timedelta(days=12, hours=8),
                status=EventStatus.PUBLISHED,
                banner_url="https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80"
            )
            db.add(ev2)
            db.flush()

            tt3 = TicketType(
                id="tt_echoes_ga",
                event_id=ev2.id,
                name="General Admission",
                capacity=300,
                sold_count=0,
                reserved_count=0,
                base_price=Decimal("200.00"),
                current_price=Decimal("200.00"),
                increment_percent=Decimal("25.00"),
                capacity_step_percent=Decimal("20.00"),
                currency="INR"
            )
            db.add(tt3)
            for tier in build_tier_rows(tt3):
                db.add(tier)

        db.commit()

        print("4. Seeding Sample Bookings & Active Tickets for Student 1...")
        student1 = db.query(User).filter_by(email="student1@eventra.local").first()
        tt_sample = db.get(TicketType, "tt_hack_solo")
        if student1 and tt_sample:
            existing_booking = db.query(Booking).filter_by(user_id=student1.id).first()
            if not existing_booking:
                booking = Booking(
                    id="bkg_sample_confirmed_1",
                    user_id=student1.id,
                    ticket_type_id=tt_sample.id,
                    quantity=1,
                    unit_price=Decimal("150.00"),
                    total_amount=Decimal("150.00"),
                    status=BookingStatus.CONFIRMED,
                    idempotency_key="seed_key_001",
                    created_at=now - timedelta(hours=2),
                )
                db.add(booking)
                db.flush()

                # Increment sold count
                tt_sample.sold_count += 1

                # Issue payment
                payment = Payment(
                    id="pay_sample_1",
                    booking_id=booking.id,
                    provider="mock",
                    provider_payment_id="mock_seed_pay_001",
                    amount=Decimal("150.00"),
                    status=PaymentStatus.SUCCESS,
                    paid_at=now - timedelta(hours=2)
                )
                db.add(payment)

                # Issue ticket with QR token
                ticket_id = "tkt_sample_1"
                token = make_token(ticket_id)
                ticket = Ticket(
                    id=ticket_id,
                    booking_id=booking.id,
                    user_id=student1.id,
                    ticket_type_id=tt_sample.id,
                    qr_token_hash=hash_token(token),
                    status=TicketStatus.ACTIVE,
                    issued_at=now - timedelta(hours=2)
                )
                db.add(ticket)

                # Add sample notification
                db.add(Notification(
                    id=new_uuid(),
                    user_id=student1.id,
                    title="Tickets Confirmed: HackPulse 2026",
                    message="Your booking #bkg_sample_confirmed_1 is confirmed. Your QR pass is ready in My Tickets.",
                    type="BOOKING_CONFIRMED",
                    is_read=False
                ))

                db.commit()
                print(f"Issued sample ticket {ticket_id} for student1@eventra.local")
                print(f"Sample QR token for instant check-in testing: {token}")

        print("\nSeed completed successfully!")
        print("Ready accounts:")
        print(" - Admin:     admin@eventra.local (Bearer token: mock-admin)")
        print(" - Organizer: tech@eventra.local (Bearer token: mock-tech)")
        print(" - Student:   student1@eventra.local (Bearer token: mock-student1)")


if __name__ == "__main__":
    seed()
