# Porikroma

Porikroma is a travel planning and community platform focused on Bangladesh. Travelers can plan solo and group trips, join shared expeditions, manage trip costs, record places they have visited, and review travel companions. Tour planners can publish trips and manage bookings. Administrators can verify planners and moderate reports.

## Contents

- [Features](#features)
- [Technology](#technology)
- [Run with Docker Compose](#run-with-docker-compose)
- [Run locally](#run-locally)
- [Environment configuration](#environment-configuration)
- [Demo accounts and sample data](#demo-accounts-and-sample-data)
- [Main workflows](#main-workflows)
- [Database schema and migrations](#database-schema-and-migrations)
- [Tests and production build](#tests-and-production-build)
- [API documentation](#api-documentation)
- [Project layout](#project-layout)

## Features

### Travelers

- Register, log in, manage a profile, and set privacy preferences.
- Create solo trips or publish group expeditions, browse trips, request to join, and manage applications.
- Use a trip workspace for itinerary, checklist, shared notes, journal, photos, map places, group chat, members, expenses, and settlements.
- Review eligible companions after completing a shared trip. Profiles show ratings and written reviews.
- Browse destinations, submit destination reviews, join community discussions, and use the AI travel planner.
- Track trip dates in the calendar. Trips you create and approved group trips you join appear on each date of the trip.
- Track visited destinations and districts in the travel footprint. Add historical passport stamps with the date visited, including travel from before joining Porikroma. Completing a trip adds its destination to participants' passports.
- Record trip expenses and settlements, and set a yearly travel budget cap in Expense management.

### Tour planners

- Create and manage commercial tour packages and scheduled departures.
- Review traveler bookings and confirm or cancel reservations.
- Submit planner verification requests for administrator review.

### Administrators

- View platform analytics and manage users, destinations, trips, groups, planner verifications, and moderation reports.
- Issue warnings or suspend/ban accounts. Warnings are visible to the affected user under **Admin notices** on their profile.
- Moderate community posts and comments.

## Technology

- Frontend: React 19, TypeScript, Vite, React Router, Leaflet.
- Backend: Python, FastAPI, Pydantic, asyncpg, PyJWT, bcrypt.
- Database: PostgreSQL 16 or later.
- Automated checks: pytest, HTTPX, and FastAPI TestClient.

## Run with Docker Compose

Requirements: Docker Engine and Docker Compose plugin.

From the repository root:

```bash
docker compose up --build
```

Compose starts PostgreSQL, the FastAPI API, and the Vite development server. The backend applies `Backend/schema.sql`, runs all ordered SQL migrations, seeds demo data, and starts the API after PostgreSQL is healthy.

- Frontend: <http://localhost:5173>
- API: <http://localhost:4000>
- Health: <http://localhost:4000/api/health>
- OpenAPI docs: <http://localhost:4000/docs>

Stop the services with `Ctrl+C`. To stop and remove the database volume too, use `docker compose down -v`; this deletes local database data.

## Run locally

Requirements: Python 3.12+, Node.js 20+, npm, and PostgreSQL 16+.

Create a PostgreSQL database and configure the backend:

```bash
createdb porikroma
cd Backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Initialize the database and start the API:

```bash
python seed.py
uvicorn app.main:app --host 0.0.0.0 --port 4000 --reload
```

The API applies the base schema and migrations on startup. In a second terminal:

```bash
cd Frontend
npm ci
npm run dev -- --host 0.0.0.0
```

Open <http://localhost:5173>. Set `VITE_API_URL` if the API is not at `http://localhost:4000`.

## Environment configuration

Backend settings are loaded from `Backend/.env` and can also be set as environment variables.

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `postgres://postgres@localhost:5432/porikroma` | PostgreSQL connection string. |
| `JWT_SECRET` | Development placeholder | Signing secret for access and recovery tokens. Set a strong, private value outside local development. |
| `PORT` | `4000` | API port. |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins, or `*` for local development. Restrict this in deployments. |
| `FRONTEND_URL` | `http://localhost:5173` | Base URL for email verification and password recovery links. |
| `GEMINI_API_KEY` | Empty | Optional Gemini key for AI-generated planner responses. |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Gemini model identifier. |
| `OPENWEATHER_API_KEY` | Empty | Optional OpenWeatherMap key. Weather routes provide fallback behavior when unavailable. |
| `EMAIL_PROVIDER` | `resend` | Email provider: `resend`, `postmark`, or `console`. |
| `EMAIL_API_KEY` | Empty | Provider key. With no key, email dispatch falls back to the application console. |
| `EMAIL_FROM` | `Porikroma <notifications@porikroma.com>` | Transactional email sender. |
| `VITE_API_URL` | `http://localhost:4000` | Frontend API base URL. |

Do not use the development JWT secret, wildcard CORS, demo passwords, or sample credentials in a public deployment.

## Demo accounts and sample data

Run `python Backend/seed.py` (or start Compose) to insert repeatable sample data. All demo accounts use password `password123`:

| Role | Email | Sample use |
| --- | --- | --- |
| Traveler | `traveler@porikroma.com` | Trips, workspace, expenses, footprint, and profile. |
| Traveler | `traveler2@porikroma.com` | Group applications and companion profile reviews. |
| Tour planner | `planner@porikroma.com` | Tours, departures, bookings, verification. |
| Administrator | `admin@porikroma.com` | User, planner, and moderation administration. |

The seed includes a completed trip shared by both traveler accounts and a 5-star written peer review from the second traveler to the first. Log in as the first traveler, then open the second traveler's profile to see the eligible **Rate and review** form. Seed operations are designed to be repeatable and avoid duplicate sample records.

## Main workflows

### Plan or join a trip

1. Sign in as a traveler and choose **New trip**.
2. Select solo travel or group expedition, choose a destination and dates, then create the trip.
3. Group expeditions appear in **Group travel → Explore**. Travelers submit join requests; the organizer reviews them in requests.
4. The trip creator and approved group members can open the trip workspace. Its tabs hold the shared itinerary, checklist, expenses, notes, memories, map places, chat, and membership tools.
5. Created trips and approved joined expeditions appear in the calendar for every date between trip start and end.

### Track spending

- Add expenses from a trip workspace. Expense entries are associated with that trip and feed its budget totals and the cross-trip ledger.
- Record, pay, or confirm settlements in the trip workspace to track who owes whom.
- Open **Expense management** to see recorded spending and set an annual cap in BDT.

### Record travel and reviews

- Open **Travel footprint → Overview** and select **Add visited place**, or use the Passport tab. Choose a destination and visit date to record a historical or recent visit.
- Mark a trip completed in its settings. Its destination is added to the passports of the creator and trip participants.
- Review a companion from the completed trip workspace or from that traveler's profile when an eligible shared trip is available. Each traveler can submit one review per companion per trip.

### Planner and admin operations

- A tour planner creates a package, adds departures, and manages bookings from the planner workspace. Travelers discover packages under **Tours** and manage reservations under **My bookings**.
- An administrator reviews planner verification requests and reports from the admin workspace. Warnings show under the affected user's profile as **Admin notices**.

## Database schema and migrations

`Backend/schema.sql` defines the base PostgreSQL schema. Startup applies every `Backend/migrations/*.sql` file in filename order after the base schema. Migrations are intended to be safe to apply on every startup. Add schema changes as a new numbered migration.

For demo data, run:

```bash
cd Backend
.venv/bin/python seed.py
```

Set `DATABASE_URL` before running the seed script if the database is not the local default.

## Tests and production build

Run the backend suite:

```bash
cd Backend
.venv/bin/python -m pytest tests -q
```

Run focused workflow and API response contract checks:

```bash
cd Backend
.venv/bin/python -m pytest tests/test_workflows.py tests/test_contracts.py -q
```

Build the frontend:

```bash
cd Frontend
npm ci
npm run build
```

## API documentation

The running FastAPI service serves interactive docs at `/docs` and OpenAPI JSON at `/openapi.json`. The route inventory is maintained in [Backend/ROUTE_MAP.md](Backend/ROUTE_MAP.md).

## Project layout

```text
Backend/
  app/routers/       FastAPI route handlers
  app/services/      AI, email, security, weather, and rate limiting
  app/schemas/       Request and response validation models
  migrations/        Ordered, idempotent SQL migrations
  tests/             Unit, API contract, and multi-user workflow tests
  schema.sql         Base PostgreSQL schema
  seed.py            Repeatable demo data
Frontend/
  src/pages/         Public, traveler, planner, and admin screens
  src/components/    Shared layout and trip workspace components
  src/api/           Typed API client modules
```
