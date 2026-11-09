# Porikroma

Porikroma is an intelligent travel planning platform and community ecosystem built specifically for discovering Bangladesh. The platform enables travelers, licensed tour operators, and platform moderators to explore 64-district destinations, organize collaborative group expeditions, split expenses in BDT, maintain a travel passport booklet, reserve commercial tours, engage in community discussions, and interact with an AI travel planning assistant.

---

## 1. Architecture & Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Lucide icons, React Router 7.
- **Backend**: Python 3.12+ / 3.14, FastAPI, asyncpg (connection pool), Pydantic v2, PyJWT, bcrypt.
- **Database**: PostgreSQL 16+.
- **Testing**: pytest, pytest-anyio, httpx, starlette TestClient (119 automated tests including contract & multi-user workflow suites).

---

## 2. Quick Start with Docker Compose (Recommended)

The repository provides a complete local development stack configured in `docker-compose.yml`.

### Start the Stack

```bash
docker compose up --build
```

This single command brings up:
1. **PostgreSQL 16**: Port `5432`, initialized with [`Backend/schema.sql`](./Backend/schema.sql) and persistent data volume `pgdata`.
2. **FastAPI Backend**: Port `4000`, runs database migrations, executes [`Backend/seed.py`](./Backend/seed.py), and starts with hot-reloading.
3. **Vite Frontend**: Port `5173`, served with live module replacement against `http://localhost:4000`.

### Service URLs

- **Frontend UI**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:4000](http://localhost:4000)
- **API Health Check**: [http://localhost:4000/api/health](http://localhost:4000/api/health)
- **Interactive OpenAPI Docs**: [http://localhost:4000/docs](http://localhost:4000/docs)

---

## 3. Local Native Setup (Without Docker)

### Prerequisites

- Python 3.10+
- Node.js 20+
- PostgreSQL 16+ running locally

### Step 1: Initialize PostgreSQL Database

```bash
createdb porikroma
```

### Step 2: Configure & Start Backend

```bash
cd Backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Copy example environment configuration
cp .env.example .env

# Run database schema initialization and initial seed data
python seed.py

# Launch FastAPI development server
uvicorn app.main:app --host 0.0.0.0 --port 4000 --reload
```

### Step 3: Configure & Start Frontend

In a separate terminal window:

```bash
cd Frontend
npm install
npm run dev
```

Visit [http://localhost:5173](http://localhost:5173) in your browser.

---

## 4. Environment Variables

The backend loads settings from `Backend/.env` (or Docker environment variables):

| Variable | Default Value | Description |
|---|---|---|
| `DATABASE_URL` | `postgres://postgres@localhost:5432/porikroma` | PostgreSQL connection URL (asyncpg format) |
| `TEST_DATABASE_URL` | *None* (optional) | Dedicated test database URL for workflow integration tests |
| `JWT_SECRET` | `replace-with-a-long-random-secret-for-jwt-signing` | Secret key used for HS256 JWT access and reset tokens |
| `PORT` | `4000` | Port on which the FastAPI application listens |
| `CORS_ORIGINS` | `*` | Allowed CORS origins (comma-separated origins or `*`) |
| `VITE_API_URL` | `http://localhost:4000` | Frontend configuration for target API server |

---

## 5. Seed Data & Default Demo Accounts

The database seed script [`Backend/seed.py`](./Backend/seed.py) creates initial destination catalogs across Bangladesh divisions, sample trips, expeditions, tour packages, departures, and demo accounts with password `password123`:

| Role | Email | Password | Pre-loaded Context |
|---|---|---|---|
| **Traveler** | `traveler@porikroma.com` | `password123` | Trips, workspace notes, checklists, footprint stamps |
| **Traveler 2** | `traveler2@porikroma.com` | `password123` | Applications, comments, peer traveler profile |
| **Tour Planner** | `planner@porikroma.com` | `password123` | Published tour packages, departures schedule, bookings |
| **Platform Admin**| `admin@porikroma.com` | `password123` | Analytics dashboard, verifications queue, moderation |

### To Re-run or Reset Seed Data

```bash
cd Backend
python seed.py
```
*Note: `seed.py` is idempotent and safe to run multiple times without duplicating entries.*

---

## 6. Running Automated Tests

The testing suite contains 119 comprehensive tests across unit, contract, and end-to-end multi-user workflow suites.

### Run All Tests

```bash
PYTHONPATH=Backend Backend/.venv/bin/pytest Backend/tests -v
```

### Run Contract Tests (Response Shape Verification)

Validates response key schemas across all 14 routers against legacy backend specifications:

```bash
PYTHONPATH=Backend Backend/.venv/bin/pytest Backend/tests/test_contracts.py -v
```

### Run Multi-User Workflow Tests

Executes the 12-stage sequential workflow (traveler trip creation, group publishing, application approval, workspace collaboration, commercial tour booking, and admin management):

```bash
PYTHONPATH=Backend Backend/.venv/bin/pytest Backend/tests/test_workflows.py -v
```

*To run workflow tests against a dedicated PostgreSQL database, set `TEST_DATABASE_URL`:*

```bash
TEST_DATABASE_URL=postgres://postgres@localhost:5432/porikroma_test pytest Backend/tests/test_workflows.py -v
```

---

## 7. API Route Map

All 111 endpoints (110 ported legacy endpoints + `/api/health`) are fully documented in [`Backend/ROUTE_MAP.md`](./Backend/ROUTE_MAP.md) detailing HTTP method, URL path, authorization requirements, and module domains.
