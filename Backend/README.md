# Porikroma backend

## Local setup

```bash
cp .env.example .env
createdb porikroma
npm install
npm run dev
```

The API listens on `http://localhost:4000`. Set `DATABASE_URL` to your local
PostgreSQL role and provide a JWT secret of at least 16 characters. The server
applies the idempotent `schema.sql` on startup and reports readiness only when
PostgreSQL is reachable.

## Main endpoints

- Authentication: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/me`
- Destinations: `GET|POST /api/destinations`
- Trips: `GET|POST /api/trips`, `PATCH /api/trips/:id/status`
- Groups: `GET|POST /api/groups`, `POST /api/groups/:id/applications`
- Expenses: `POST /api/expenses`, `GET /api/trips/:id/expenses`
- Reviews: `POST /api/reviews`, `POST /api/traveler-reviews`
- Profiles/privacy: `GET|PUT /api/me/profile`, `GET|PUT /api/me/privacy`
- Companions: `GET /api/me/companions`
- Notifications: `GET /api/notifications`, `PATCH /api/notifications/:id/read`
- Community: `GET|POST /api/community/posts`, `POST /api/community/posts/:id/reactions`
- Tours/bookings: `GET /api/tours`, `POST /api/tours`, `POST /api/departures/:id/bookings`
- Passport: `GET|POST /api/me/passport`
- Admin: `GET /api/admin/analytics`, `GET /api/admin/reports`
- Health: `GET /health`, `GET /ready`

Authenticated endpoints require:

```text
Authorization: Bearer <jwt>
```
