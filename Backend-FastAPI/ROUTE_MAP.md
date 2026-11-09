# Porikroma FastAPI Migration: Route Map & Implementation Breakdown

This document provides a comprehensive mapping of all endpoints from the legacy Fastify backend (`Backend/src/server.ts`) to the modular FastAPI backend (`Backend-FastAPI`).

Each endpoint specifies its HTTP method, exact path, authentication & authorization requirement, and the target implementation part (Parts 1 through 13).

---

## 1. Summary of Implementation Parts

| Part | Domain / Module | Route Count | Primary Focus |
|---|---|---|---|
| **Part 1** | Analysis, Skeleton & Health | 3 | FastAPI project skeleton, config, DB pool, CORS, and `/api/health` |
| **Part 2** | Authentication & Onboarding | 7 | Register, login, demo-login, forgot/reset password, email verification, change password |
| **Part 3** | Users, Profiles & Social Network | 11 | Current user, user profile, privacy, public profile, follow, block, report, verification request |
| **Part 4** | Destinations & Reviews | 7 | Destination catalog search & details, admin/planner destination management, reviews |
| **Part 5** | Trips Management | 6 | Trips CRUD, personal trip listings, status updates, and ownership validation |
| **Part 6** | Trip Workspace, Itinerary & Checklists | 7 | Full multi-tab workspace loader, daily itinerary items CRUD, packing checklist items |
| **Part 7** | Trip Workspace Collaboration | 8 | Workspace notes/journal, interactive map places of interest, trip member invitations & management |
| **Part 8** | Expenses & Settlements | 7 | Cross-trip expense overview, trip expense ledger, settlements tracking & status update |
| **Part 9** | Group Travel Expeditions & Chat | 10 | Discoverable group expeditions, applications flow, applicant approval/rejection, group chat messages |
| **Part 10** | Travel Footprint, Passport & Wishlist | 7 | Bangladesh 64-district footprint, digital travel passport stamps, travel achievements, wishlist |
| **Part 11** | AI Travel Planner & Assistant | 5 | AI chat sessions, conversation history, Bangladesh domain-specific intelligent advice synthesis |
| **Part 12** | Community Discussions & Notifications | 10 | Public/followers discussions, post comments & reactions, user notification alerts & read status |
| **Part 13** | Tour Planner, Reputation & Admin Center | 23 | Tour packages & departures, bookings lifecycle, traveler reviews, admin metrics, user moderation & verifications |

**Total Endpoints**: 111 (110 legacy routes + 1 new standard `/api/health`)

---

## 2. Complete Route Map Table

### Part 1: Analysis, Skeleton & Health Check

| Method | Path | Auth Requirement | Target Part | Description |
|---|---|---|---|---|
| `GET` | `/health` | Public | Part 1 | Service health status with database readiness check |
| `GET` | `/ready` | Public | Part 1 | Kubernetes / process readiness check |
| `GET` | `/api/health` | Public | Part 1 | Standard health check returning `{"status": "ok"}` and verifying DB connectivity |

---

### Part 2: Authentication & Onboarding

| Method | Path | Auth Requirement | Target Part | Description |
|---|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Part 2 | Register new traveler/planner account with profile & privacy settings |
| `POST` | `/api/auth/login` | Public | Part 2 | Authenticate with email and password, check account status, return JWT |
| `POST` | `/api/auth/demo-login` | Public | Part 2 | One-click demo login for TRAVELER, TOUR_PLANNER, or ADMIN |
| `POST` | `/api/auth/forgot-password` | Public | Part 2 | Dispatches password reset JWT token and link |
| `POST` | `/api/auth/reset-password` | Public (Reset Token) | Part 2 | Verifies reset token and updates password hash |
| `POST` | `/api/auth/verify-email` | Public | Part 2 | Email verification token handler |
| `POST` | `/api/auth/change-password` | Any authenticated user | Part 2 | Authenticated user changes current password |

---

### Part 3: Users, Profiles & Social Network

| Method | Path | Auth Requirement | Target Part | Description |
|---|---|---|---|---|
| `GET` | `/api/me` | Any authenticated user | Part 3 | Fetch current authenticated user record |
| `GET` | `/api/me/profile` | Any authenticated user | Part 3 | Fetch full traveler profile with travel style, bio, interests, rating |
| `PUT` | `/api/me/profile` | Any authenticated user | Part 3 | Update user profile, bio, travel style, interests array |
| `GET` | `/api/me/privacy` | Any authenticated user | Part 3 | Get user visibility and privacy settings |
| `PUT` | `/api/me/privacy` | Any authenticated user | Part 3 | Update profile, history, footprint, and review visibility preferences |
| `GET` | `/api/users/:id/profile` | Any authenticated user | Part 3 | Public profile for another traveler with reviews and ratings |
| `POST` | `/api/users/:id/follow` | Any authenticated user | Part 3 | Follow another traveler |
| `DELETE` | `/api/users/:id/follow` | Any authenticated user | Part 3 | Unfollow another traveler |
| `POST` | `/api/users/:id/block` | Any authenticated user | Part 3 | Block another user from interactions |
| `POST` | `/api/users/:id/reports` | Any authenticated user | Part 3 | Report a user for community safety review |
| `POST` | `/api/me/verification` | Any authenticated user | Part 3 | Submit request to be verified as a Tour Planner |

---

### Part 4: Destinations & Destination Reviews

| Method | Path | Auth Requirement | Target Part | Description |
|---|---|---|---|---|
| `GET` | `/api/destinations` | Public | Part 4 | Browse and search destinations with text filter, category, ratings |
| `GET` | `/api/destinations/:id` | Public | Part 4 | Detailed destination dossier with community reviews |
| `POST` | `/api/destinations` | Any authenticated user | Part 4 | Create new destination entry (used by Admin/Planner) |
| `PUT` | `/api/destinations/:id` | Role: ADMIN or TOUR_PLANNER | Part 4 | Update destination details, budget, cover image |
| `DELETE` | `/api/destinations/:id` | Role: ADMIN | Part 4 | Delete destination from catalog |
| `GET` | `/api/destinations/:id/reviews` | Public | Part 4 | List public traveler reviews for a destination |
| `POST` | `/api/reviews` | Any authenticated user | Part 4 | Submit 1-5 star review and commentary for a destination |

---

### Part 5: Trips Management (Core CRUD & Status)

| Method | Path | Auth Requirement | Target Part | Description |
|---|---|---|---|---|
| `GET` | `/api/trips` | Any authenticated user | Part 5 | List all trips created by or joined by the user |
| `GET` | `/api/trips/:id` | Any authenticated user | Part 5 | Fetch trip summary, dates, destination, budget spent |
| `POST` | `/api/trips` | Any authenticated user | Part 5 | Create new trip and assign creator as OWNER in trip_members |
| `PUT` | `/api/trips/:id` | Any authenticated user (Trip access) | Part 5 | Update trip details (dates, budget, status, visibility) |
| `DELETE` | `/api/trips/:id` | Any authenticated user (Trip access) | Part 5 | Delete trip and cascade related records |
| `PATCH` | `/api/trips/:id/status` | Any authenticated user (Trip creator) | Part 5 | Transition trip state (DRAFT, PLANNING, UPCOMING, COMPLETED, CANCELLED) |

---

### Part 6: Trip Workspace, Itinerary & Checklists

| Method | Path | Auth Requirement | Target Part | Description |
|---|---|---|---|---|
| `GET` | `/api/trips/:id/workspace` | Any authenticated user (Trip access) | Part 6 | Aggregated workspace payload (itinerary, checklist, notes, photos, members, expenses, map, group) |
| `POST` | `/api/trips/:id/itinerary` | Any authenticated user (Trip access) | Part 6 | Add daily itinerary stop / schedule item |
| `PUT` | `/api/trips/:id/itinerary/:itemId` | Any authenticated user (Trip access) | Part 6 | Update itinerary item title, location, notes, sort order |
| `DELETE` | `/api/trips/:id/itinerary/:itemId` | Any authenticated user (Trip access) | Part 6 | Remove item from trip itinerary |
| `POST` | `/api/trips/:id/checklist` | Any authenticated user (Trip access) | Part 6 | Add task or packing checklist item |
| `PATCH` | `/api/trips/:id/checklist/:itemId` | Any authenticated user (Trip access) | Part 6 | Toggle checklist item completion status |
| `DELETE` | `/api/trips/:id/checklist/:itemId` | Any authenticated user (Trip access) | Part 6 | Delete checklist item |

---

### Part 7: Trip Workspace Collaboration (Notes, Map Places, Members)

| Method | Path | Auth Requirement | Target Part | Description |
|---|---|---|---|---|
| `POST` | `/api/trips/:id/notes` | Any authenticated user (Trip access) | Part 7 | Add persistent shared note or journal memory |
| `DELETE` | `/api/trips/:id/notes/:noteId` | Any authenticated user (Trip access) | Part 7 | Delete trip note |
| `GET` | `/api/trips/:id/map-places` | Any authenticated user | Part 7 | List points of interest / attractions pinned for this trip |
| `POST` | `/api/trips/:id/map-places` | Any authenticated user (Trip access) | Part 7 | Pin place of interest with category, notes, coordinates |
| `DELETE` | `/api/trips/:id/map-places/:placeId` | Any authenticated user (Trip access) | Part 7 | Delete pinned map place |
| `GET` | `/api/trips/:id/members` | Any authenticated user | Part 7 | List all members collaborating on trip |
| `POST` | `/api/trips/:id/members` | Any authenticated user (Trip access) | Part 7 | Invite member by email, add to trip_members, notify user |
| `DELETE` | `/api/trips/:id/members/:userId` | Any authenticated user (Trip access) | Part 7 | Remove participant from trip |

---

### Part 8: Expenses & Settlements

| Method | Path | Auth Requirement | Target Part | Description |
|---|---|---|---|---|
| `GET` | `/api/expenses/overview` | Any authenticated user | Part 8 | Cross-trip expense ledger with category sums and total budget usage |
| `GET` | `/api/trips/:id/expenses` | Any authenticated user | Part 8 | List expenses recorded for a specific trip |
| `POST` | `/api/expenses` | Any authenticated user | Part 8 | Record new trip expense with category and amount |
| `DELETE` | `/api/expenses/:id` | Any authenticated user | Part 8 | Delete expense entry |
| `GET` | `/api/trips/:id/settlements` | Any authenticated user | Part 8 | List recorded settlements between participants |
| `POST` | `/api/trips/:id/settlements` | Any authenticated user | Part 8 | Record payment settlement between participants |
| `PATCH` | `/api/settlements/:id/status` | Any authenticated user | Part 8 | Update settlement status (PENDING, PAID, CANCELLED) |

---

### Part 9: Group Travel Expeditions, Applications & Messages

| Method | Path | Auth Requirement | Target Part | Description |
|---|---|---|---|---|
| `GET` | `/api/groups` | Public | Part 9 | Browse all discoverable published group expeditions |
| `GET` | `/api/groups/:id` | Public | Part 9 | Expedition dossier with organizer info, confirmed members, itinerary |
| `POST` | `/api/groups` | Any authenticated user | Part 9 | Publish group expedition linked to a trip |
| `GET` | `/api/groups/my-groups` | Any authenticated user | Part 9 | List expeditions organized or joined by the user |
| `GET` | `/api/groups/:id/applications` | Any authenticated user | Part 9 | List participant applications for an expedition |
| `POST` | `/api/groups/:id/applications` | Any authenticated user | Part 9 | Apply to join expedition with experience & dietary answers |
| `GET` | `/api/me/group-applications` | Any authenticated user | Part 9 | View status of all applications submitted by the user |
| `PATCH` | `/api/applications/:id/status` | Any authenticated user | Part 9 | Approve, reject, or withdraw application; on approval adds to group & trip members |
| `GET` | `/api/groups/:id/messages` | Any authenticated user | Part 9 | Fetch group message history |
| `POST` | `/api/groups/:id/messages` | Any authenticated user | Part 9 | Post message to group expedition stream |

---

### Part 10: Travel Footprint, Passport, Achievements & Wishlist

| Method | Path | Auth Requirement | Target Part | Description |
|---|---|---|---|---|
| `GET` | `/api/me/footprint` | Any authenticated user | Part 10 | 64-district footprint statistics, visited districts, trip timeline |
| `GET` | `/api/me/passport` | Any authenticated user | Part 10 | Digital travel passport booklet with destination stamps |
| `POST` | `/api/me/passport` | Any authenticated user | Part 10 | Stamp passport with visited destination and date |
| `DELETE` | `/api/me/passport/:id` | Any authenticated user | Part 10 | Delete passport stamp entry |
| `GET` | `/api/me/achievements` | Any authenticated user | Part 10 | List system travel achievements with unlocked state |
| `GET` | `/api/me/wishlist` | Any authenticated user | Part 10 | List saved destinations in user's wishlist |
| `POST` | `/api/me/wishlist/:id` | Any authenticated user | Part 10 | Toggle destination saved to user wishlist |

---

### Part 11: AI Planner & Travel Assistant

| Method | Path | Auth Requirement | Target Part | Description |
|---|---|---|---|---|
| `GET` | `/api/ai/conversations` | Any authenticated user | Part 11 | List user AI assistant conversation threads |
| `POST` | `/api/ai/conversations` | Any authenticated user | Part 11 | Create new travel planning session thread |
| `GET` | `/api/ai/conversations/:id/messages` | Any authenticated user (Thread owner) | Part 11 | Retrieve conversation history |
| `POST` | `/api/ai/conversations/:id/messages` | Any authenticated user (Thread owner) | Part 11 | Send prompt and synthesize Bangladesh travel guidance |
| `DELETE` | `/api/ai/conversations/:id` | Any authenticated user (Thread owner) | Part 11 | Delete conversation thread |

---

### Part 12: Community Discussions & Notifications

| Method | Path | Auth Requirement | Target Part | Description |
|---|---|---|---|---|
| `GET` | `/api/community/posts` | Any authenticated user | Part 12 | Feed of discussions with author info, like count, comment count |
| `POST` | `/api/community/posts` | Any authenticated user | Part 12 | Publish community post |
| `DELETE` | `/api/community/posts/:id` | Any authenticated user (Author or ADMIN) | Part 12 | Delete discussion post |
| `POST` | `/api/community/posts/:id/reactions` | Any authenticated user | Part 12 | Toggle like reaction on discussion post |
| `GET` | `/api/community/posts/:id/comments` | Any authenticated user | Part 12 | List comments for a discussion post |
| `POST` | `/api/community/posts/:id/comments` | Any authenticated user | Part 12 | Add comment reply to a discussion post |
| `GET` | `/api/notifications` | Any authenticated user | Part 12 | List user in-app notification alerts |
| `PATCH` | `/api/notifications/:id/read` | Any authenticated user | Part 12 | Mark single notification as read |
| `PATCH` | `/api/notifications/read-all` | Any authenticated user | Part 12 | Mark all user notifications as read |
| `DELETE` | `/api/notifications/:id` | Any authenticated user | Part 12 | Delete notification item |

---

### Part 13: Tour Planner Operations, Bookings, Reputation & Admin Control Center

| Method | Path | Auth Requirement | Target Part | Description |
|---|---|---|---|---|
| `GET` | `/api/tours` | Public | Part 13 | List published tour packages with departures count |
| `GET` | `/api/tours/:id` | Public | Part 13 | Tour dossier with departures schedule & participant booking count |
| `POST` | `/api/tours` | Role: TOUR_PLANNER or ADMIN | Part 13 | Create tour package |
| `PUT` | `/api/tours/:id` | Any authenticated user (Planner owner or ADMIN) | Part 13 | Update tour details, pricing, capacity |
| `GET` | `/api/planner/tours` | Role: TOUR_PLANNER or ADMIN | Part 13 | Tour planner dashboard tours list with statistics |
| `POST` | `/api/tours/:id/departures` | Role: TOUR_PLANNER (owner) or ADMIN | Part 13 | Schedule departure date range and capacity |
| `GET` | `/api/planner/departures` | Role: TOUR_PLANNER or ADMIN | Part 13 | List scheduled departures and seat occupancy |
| `GET` | `/api/planner/bookings` | Role: TOUR_PLANNER or ADMIN | Part 13 | Tour participants bookings list for planner review |
| `PATCH` | `/api/bookings/:id/status` | Any authenticated user | Part 13 | Confirm or cancel traveler departure booking |
| `POST` | `/api/departures/:id/bookings` | Any authenticated user | Part 13 | Traveler books seats on scheduled tour departure |
| `GET` | `/api/me/bookings` | Any authenticated user | Part 13 | Traveler lists their own tour bookings |
| `GET` | `/api/me/traveler-reviews/pending` | Any authenticated user | Part 13 | List completed trip companions awaiting peer review |
| `POST` | `/api/traveler-reviews` | Any authenticated user | Part 13 | Submit 7-metric peer review for fellow traveler |
| `GET` | `/api/admin/analytics` | Role: ADMIN | Part 13 | High-level platform statistics (users, trips, groups, reports) |
| `GET` | `/api/admin/users` | Role: ADMIN | Part 13 | Platform user directory with account status and trip counts |
| `PATCH` | `/api/admin/users/:id/role` | Role: ADMIN | Part 13 | Alter user role (TRAVELER, TOUR_PLANNER, ADMIN) |
| `PATCH` | `/api/admin/users/:id/status` | Role: ADMIN | Part 13 | Change account status (ACTIVE, SUSPENDED, BANNED) |
| `GET` | `/api/admin/trips` | Role: ADMIN | Part 13 | Monitor all trips created across the platform |
| `GET` | `/api/admin/groups` | Role: ADMIN | Part 13 | Monitor all published group expeditions |
| `GET` | `/api/admin/verifications` | Role: ADMIN | Part 13 | Queue of pending tour planner verification requests |
| `PATCH` | `/api/admin/verifications/:id` | Role: ADMIN | Part 13 | Approve or reject planner verification, promotes role to TOUR_PLANNER |
| `GET` | `/api/admin/reports` | Role: ADMIN | Part 13 | Community moderation queue of user safety reports |
| `POST` | `/api/admin/reports/:id/actions` | Role: ADMIN | Part 13 | Enforce action on report (DISMISSED, WARNING, SUSPENDED, BANNED) |
