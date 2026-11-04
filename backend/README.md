# Eventra Backend (foundation)

## Setup
```
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # then fill in values
```
Put your Firebase service account JSON at the path set in `FIREBASE_CREDENTIALS_PATH`.

## Run
```
uvicorn app.main:app --reload
```
Open http://localhost:8000/docs

## Connect the Next.js frontend
1. Copy the project-root `.env.local.example` to `.env.local` and fill in the Firebase web app values from Firebase project settings. These are client-side Firebase configuration values, not the service-account credentials.
2. In Firebase Authentication, enable the Email/Password and Google providers and add `localhost` to the authorized domains. Email/password accounts must already exist in Firebase; first-time users can sign in with Google.
3. Configure `backend/.env` with a working `DATABASE_URL`, the path to your Firebase service-account JSON, and `CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000`.
4. Start the API from the `backend` directory with `uvicorn app.main:app --reload`, then run the frontend from the project root with `pnpm dev`.

The login form signs in with Firebase, sends the resulting ID token to `POST /auth/login`, and displays the Eventra user returned by the API. The frontend API URL can be changed with `NEXT_PUBLIC_API_BASE_URL`.

## Endpoints so far
- `GET /health`: API and database check
- `POST /auth/login`: send `Authorization: Bearer <firebase id token>`; creates the user on first login
- `GET /auth/me`: current user
