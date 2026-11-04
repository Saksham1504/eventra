# Eventra — Smart Campus Events Platform

A full-stack web application for discovering, booking, and managing campus events with dynamic pricing, real-time WebSocket updates, QR check-in, and an organizer dashboard.

---
![Uploading image.png…]()

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS v4, shadcn/ui |
| Backend | FastAPI (Python), SQLAlchemy, SQLite (dev) / MySQL (prod) |
| Auth | Firebase Auth (prod) or Dev Mock Tokens (dev) |
| Payments | Razorpay (prod) or Mock mode (dev) |
| Real-time | WebSockets (FastAPI) |
| QR Scanning | html5-qrcode |

---

## Prerequisites

- **Node.js** 18+ and **pnpm** (`npm install -g pnpm`)
- **Python** 3.11+
- **Git**

---

## Project Structure

```
Eventra/
├── backend/          # FastAPI Python backend
│   ├── app/          # Application code (routers, models, services)
│   ├── scripts/      # seed.py, demo_scenarios.py
│   ├── tests/        # Pytest test suite
│   ├── .env          # Backend environment variables (created below)
│   └── requirements.txt
├── app/              # Next.js pages (App Router)
├── components/       # Shared React components
├── lib/              # API client, auth context, Firebase helpers
├── .env.local        # Frontend environment variables (created below)
└── package.json
```

---

## Quickstart (Dev / Mock Mode)

> **No Firebase account or MySQL needed.** Everything works with mock auth and SQLite out of the box.

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd Eventra

# Install frontend dependencies
npx pnpm install

# Create and activate Python virtual environment
python -m venv venv

# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

# Install backend dependencies
pip install -r backend/requirements.txt
```

---

### 2. Configure Environment

#### Backend — `backend/.env`

Create this file (already included in the repo for dev):

```env
DATABASE_URL=sqlite:///./eventra_dev.db
FIREBASE_CREDENTIALS_PATH=./firebase-service-account.json
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
ADMIN_EMAILS=admin@eventra.local,you@example.com
ALLOWED_EMAIL_DOMAINS=
QR_SECRET=dev-only-secret-change-me-long-random-string-12345
RESERVATION_MINUTES=10
MAX_TICKETS_PER_BOOKING=4
CANCEL_BEFORE_HOURS=24
PAYMENT_MODE=mock
```

#### Frontend — `.env.local`

Create this file in the project root (already included for dev):

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_FIREBASE_API_KEY=dev-firebase-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=dev-eventra.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=dev-eventra
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1234567890
NEXT_PUBLIC_FIREBASE_APP_ID=1:1234567890:web:abcdef
```

> When `NEXT_PUBLIC_FIREBASE_API_KEY` starts with `dev-`, the app skips real Firebase and uses mock tokens automatically.

---

### 3. Seed the Database

```bash
# From the project root (venv must be active)
python backend/scripts/seed.py
```

This creates:
- 4 colleges (DTU, IITD, NSUT, IIITD)
- 1 admin, 2 approved organizers, 1 pending organizer, 5 students
- 2 published events (HackPulse 2026, Echoes 2026) with ticket types
- Sample bookings, payments, and QR tickets

---

### 4. Start the Backend

```bash
# From the project root (venv must be active)
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --app-dir backend
```

Or from inside the `backend/` directory:

```bash
cd backend
python -m uvicorn app.main:app --reload
```

Backend runs at: **http://localhost:8000**
Interactive API docs: **http://localhost:8000/docs**

---

### 5. Start the Frontend

Open a **new terminal** in the project root:

```bash
npx pnpm dev
# or
npm run dev
```

Frontend runs at: **http://localhost:3000**

---

## Logging In (Dev Mode)

| Email | Role |
|-------|------|
| Any email | Student |
| `admin@eventra.local` | Admin |
| `organizer@eventra.local` | Organizer |

Use **any password** — Firebase is bypassed in dev mode.

You can also switch roles instantly using the **Dev Role Switcher** dropdown in the navigation bar.

---

## Running Tests

```bash
# Backend tests (from project root, venv active)
python -m pytest backend/tests -v
```

---

## Running the Demo Script

Demonstrates dynamic pricing, capacity protection, and QR check-in atomicity:

```bash
python backend/scripts/demo_scenarios.py
```

---

## Production Setup

### Firebase (Real Auth)

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Email/Password** and **Google** sign-in providers
3. Add `localhost` and your production domain to **Authorized Domains**
4. Generate a **Service Account** JSON key and save it as `backend/firebase-service-account.json`
5. Update `.env.local` with your real Firebase config values from **Project Settings → Your Apps**

### MySQL (Production Database)

Update `backend/.env`:

```env
DATABASE_URL=mysql+pymysql://user:password@localhost:3306/eventra
```

### Razorpay (Real Payments)

Update `backend/.env`:

```env
PAYMENT_MODE=razorpay
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
```

---

## Key Features

- 🎟️ **Dynamic Pricing** — ticket prices rise 25% every 20% capacity sold
- ⏱️ **10-minute Seat Hold** — seats reserved while you pay, auto-released on timeout
- 📡 **Live WebSocket Updates** — price and availability update in real time
- 📷 **QR Check-In** — camera scanner + manual token entry for event gates
- 📊 **Organizer Analytics** — revenue, sales by day, ticket breakdown
- 🛡️ **Admin Console** — user management, organizer approvals, platform stats
- 🔔 **Notifications** — booking confirmations and updates

---

## API Reference

Full interactive docs available at **http://localhost:8000/docs** when the backend is running.

| Group | Base Path |
|-------|-----------|
| Auth | `/auth` |
| Events | `/events` |
| Bookings | `/bookings` |
| Payments | `/payments` |
| Tickets | `/tickets` |
| Check-In | `/checkin` |
| Organizer | `/organizers`, `/analytics` |
| Admin | `/admin` |
| Notifications | `/notifications` |
| WebSocket | `ws://localhost:8000/ws/events/{event_id}` |
