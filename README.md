# Porikroma

Porikroma is a travel planning platform for discovering destinations, creating
trips, joining group journeys, managing expenses, sharing travel experiences,
and building traveler reputation.

The repository contains:

- `Frontend/` — React 19 + TypeScript + Vite application.
- `Backend-FastAPI/` — Python 3.14 + FastAPI API with PostgreSQL persistence.

## Requirements

- Python 3.10+
- Node.js 20+
- PostgreSQL 16+
- A local PostgreSQL database named `porikroma`

## Quick start

### 1. Configure PostgreSQL

Create the database and copy the backend environment file:

```bash
createdb porikroma
cp Backend-FastAPI/.env.example Backend-FastAPI/.env
```

Update `Backend-FastAPI/.env` if your PostgreSQL username or connection settings
differ. Never commit `.env`.

### 2. Start the backend

```bash
cd Backend-FastAPI
pip install -r requirements.txt
uvicorn app.main:app --port 4000 --host 0.0.0.0
```

The backend listens on `http://localhost:4000`.

Health checks:

```bash
curl http://localhost:4000/api/health
curl http://localhost:4000/health
curl http://localhost:4000/ready
```

### 3. Start the frontend

In another terminal:

```bash
cd Frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## Production builds

```bash
cd Backend && npm run build
cd ../Frontend && npm run build
```

## Backend API

The API includes authentication, destinations, trips, groups, applications,
expenses, traveler reviews, profiles, privacy, notifications, community,
traveler passport, tours, bookings, moderation, trip workspaces, and AI
conversation persistence. See [Backend-FastAPI/ROUTE_MAP.md](./Backend-FastAPI/ROUTE_MAP.md) for the
endpoint list.

Authenticated requests use:

```text
Authorization: Bearer <jwt>
```

## Database

The PostgreSQL schema is maintained in
[Backend-FastAPI/schema.sql](./Backend-FastAPI/schema.sql). It is additive and uses
`CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` so existing local
records are preserved.

## Current status

The complete route and interaction audit is documented in
[FULL_APPLICATION_FUNCTIONALITY_AUDIT.md](./FULL_APPLICATION_FUNCTIONALITY_AUDIT.md).
That document distinguishes fully integrated flows from areas that still need
additional UI/API work, such as password reset tokens, direct messaging,
uploads, map data, and advanced admin screens.

## Security

- Do not commit `.env`, passwords, JWT secrets, private keys, or database dumps.
- Use a unique long JWT secret outside local development.
- Use a restricted PostgreSQL role in deployed environments.
- Configure CORS and HTTPS appropriately before deployment.
