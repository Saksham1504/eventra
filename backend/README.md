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

## Endpoints so far
- `GET /health`: API and database check
- `POST /auth/login`: send `Authorization: Bearer <firebase id token>`; creates the user on first login
- `GET /auth/me`: current user
