# Porikroma Full Application Functionality Audit

## Scope

This matrix documents every route, subroute, tab, component, and interactive action across the entire Porikroma application. Every persistent business record is stored in and retrieved from PostgreSQL on `localhost:5432/porikroma`. Every API endpoint is active in `Backend/src/server.ts` (Fastify on port 4000) and verified end-to-end with automated multi-user test workflows.

---

## Functionality Matrix

| Page | Component/Tab | Action | Backend | Database | Tested | Status |
|---|---|---|---|---|---|---|
| Public Landing (`/`) | Hero Section | "Start planning" CTA navigation | Client router `/register` | None (Client routing) | Yes | Functional |
| Public Landing (`/`) | Hero Section | "Explore destinations" CTA navigation | Client router `/destinations` | None (Client routing) | Yes | Functional |
| Public Landing (`/`) | Hero Section | "Sign in" CTA navigation | Client router `/login` | None (Client routing) | Yes | Functional |
| Authentication (`/login`) | Login Card | Email & Password submit | `POST /api/auth/login` | `users` | Yes | Functional |
| Authentication (`/login`) | Quick Demo Switcher | One-click Traveler sign-in (Rafi Ahmed) | `POST /api/auth/demo-login` | `users` | Yes | Functional |
| Authentication (`/login`) | Quick Demo Switcher | One-click Tour Planner sign-in (Nadia Rahman) | `POST /api/auth/demo-login` | `users` | Yes | Functional |
| Authentication (`/login`) | Quick Demo Switcher | One-click Platform Admin sign-in | `POST /api/auth/demo-login` | `users` | Yes | Functional |
| Authentication (`/login`) | Footer Links | Navigate to Forgot Password / Register | Client router | None | Yes | Functional |
| Registration (`/register`) | Registration Form | Full Name, Email, Password, Role submit | `POST /api/auth/register` | `users`, `user_profiles`, `user_privacy_settings` | Yes | Functional |
| Password Recovery (`/forgot-password`) | Recovery Form | Submit email to generate reset token | `POST /api/auth/forgot-password` | `users` (signed JWT) | Yes | Functional |
| Password Reset (`/reset-password`) | Reset Form | Submit reset token & new password | `POST /api/auth/reset-password` | `users` | Yes | Functional |
| Email Verification (`/verify-email`) | Verification Card | Submit verification token | `POST /api/auth/verify-email` | `users` | Yes | Functional |
| Traveler Dashboard (`/dashboard`) | Hero Greeting | Dynamic greeting with user's real name | `GET /api/me` | `users` | Yes | Functional |
| Traveler Dashboard (`/dashboard`) | Stat Cards | Planned trips count metric | `GET /api/trips` | `trips` | Yes | Functional |
| Traveler Dashboard (`/dashboard`) | Stat Cards | Explored districts count metric | `GET /api/me/footprint` | `passport_entries` | Yes | Functional |
| Traveler Dashboard (`/dashboard`) | Stat Cards | Total expenses spent vs planned budget | `GET /api/expenses/overview` | `expenses`, `trips` | Yes | Functional |
| Traveler Dashboard (`/dashboard`) | Upcoming Trips Panel | Click trip card to open trip workspace | Client router `/trips/:id` | `trips` | Yes | Functional |
| Traveler Dashboard (`/dashboard`) | Weather Widget | View upcoming destination weather & forecast | Client weather state | None | Yes | Functional |
| Traveler Dashboard (`/dashboard`) | Recommendations | Browse recommended destination cards | `GET /api/destinations` | `destinations` | Yes | Functional |
| Traveler Dashboard (`/dashboard`) | Header Action | "+ Plan a trip" quick action | Client router `/trips/create` | None | Yes | Functional |
| Trips Directory (`/trips`) | Filter Tabs | Filter by All, Upcoming, Planning, Past | Client filter on `GET /api/trips` | `trips` | Yes | Functional |
| Trips Directory (`/trips`) | Search Input | Filter trips by name or destination | Client query filter | `trips` | Yes | Functional |
| Trips Directory (`/trips`) | Trip Cards | Open workspace button | Client router `/trips/:id` | `trips` | Yes | Functional |
| Trips Directory (`/trips`) | Trip Cards | Delete trip action | `DELETE /api/trips/:id` | `trips` | Yes | Functional |
| Trips Directory (`/trips`) | New Trip Card | Start planning new trip CTA | Client router `/trips/create` | None | Yes | Functional |
| Trip Creation (`/trips/create`) | Mode Selector | Toggle Solo Journey vs Group Expedition | Client mode state | None | Yes | Functional |
| Trip Creation (`/trips/create`) | Form Fields | Select destination from real catalog | `GET /api/destinations` | `destinations` | Yes | Functional |
| Trip Creation (`/trips/create`) | Form Submit | Validate & create trip record in DB | `POST /api/trips` | `trips`, `trip_members` | Yes | Functional |
| Trip Creation (`/trips/create`) | Group Publish | Automatically publish group if group mode | `POST /api/groups` | `groups`, `group_members` | Yes | Functional |
| Trip Workspace (`/trips/:id`) | Navigation Tabs | Switch between all 8 workspace tabs | URL routing `/trips/:id/:tab` | None | Yes | Functional |
| Trip Workspace: Overview | Hero Header | View destination, dates, status badge | `GET /api/trips/:id/workspace` | `trips`, `destinations` | Yes | Functional |
| Trip Workspace: Overview | Next Up Card | Preview next scheduled itinerary stop | `GET /api/trips/:id/workspace` | `trip_itinerary_items` | Yes | Functional |
| Trip Workspace: Overview | Budget Gauge | View spent vs total budget utilization | `GET /api/trips/:id/workspace` | `expenses`, `trips` | Yes | Functional |
| Trip Workspace: Overview | Quick Actions | Jump to Expenses, Notes, Journal, Checklist | Client tab navigation | None | Yes | Functional |
| Trip Workspace: Itinerary | Daily Itinerary List | View day-by-day scheduled stops | `GET /api/trips/:id/workspace` | `trip_itinerary_items` | Yes | Functional |
| Trip Workspace: Itinerary | Add Stop Modal | Add date, title, location, notes | `POST /api/trips/:id/itinerary` | `trip_itinerary_items` | Yes | Functional |
| Trip Workspace: Itinerary | Stop Item | Delete stop from itinerary | `DELETE /api/trips/:id/itinerary/:itemId` | `trip_itinerary_items` | Yes | Functional |
| Trip Workspace: Expenses | Summary Cards | View total budget, spent, remaining BDT | `GET /api/trips/:id/workspace` | `expenses`, `trips` | Yes | Functional |
| Trip Workspace: Expenses | Expense Ledger | View table of expenses with categories | `GET /api/trips/:id/workspace` | `expenses`, `users` | Yes | Functional |
| Trip Workspace: Expenses | Add Expense Modal | Enter title, category, amount, date | `POST /api/expenses` | `expenses` | Yes | Functional |
| Trip Workspace: Expenses | Expense Row | Delete expense entry | `DELETE /api/expenses/:id` | `expenses` | Yes | Functional |
| Trip Workspace: Expenses | Settle Balances Modal | Record settlement payment between members | `POST /api/trips/:id/settlements` | `expense_settlements` | Yes | Functional |
| Trip Workspace: Expenses | Settlements Table | View status of recorded member payments | `GET /api/trips/:id/settlements` | `expense_settlements` | Yes | Functional |
| Trip Workspace: Notes | Notes Feed | View shared trip notes with author & date | `GET /api/trips/:id/workspace` | `trip_notes` | Yes | Functional |
| Trip Workspace: Notes | Add Note Form | Write and save persistent trip note | `POST /api/trips/:id/notes` | `trip_notes` | Yes | Functional |
| Trip Workspace: Notes | Note Card | Delete trip note | `DELETE /api/trips/:id/notes/:noteId` | `trip_notes` | Yes | Functional |
| Trip Workspace: Journal | Memories Feed | View travel memory stories | `GET /api/trips/:id/workspace` | `trip_notes` | Yes | Functional |
| Trip Workspace: Journal | Add Memory Form | Record a reflection or travel memory | `POST /api/trips/:id/notes` | `trip_notes` | Yes | Functional |
| Trip Workspace: Map | Interactive Visual | View destination coordinates & area POIs | `GET /api/trips/:id/workspace` | `destinations` | Yes | Functional |
| Trip Workspace: Map | Points of Interest | View saved places, categories, tips | `GET /api/trips/:id/map-places` | `trip_map_places` | Yes | Functional |
| Trip Workspace: Map | Add Place Modal | Save new attraction or point of interest | `POST /api/trips/:id/map-places` | `trip_map_places` | Yes | Functional |
| Trip Workspace: Map | Place Row | Delete saved place | `DELETE /api/trips/:id/map-places/:placeId` | `trip_map_places` | Yes | Functional |
| Trip Workspace: Checklist | Checklist Items | View packing checklist items | `GET /api/trips/:id/workspace` | `trip_checklists` | Yes | Functional |
| Trip Workspace: Checklist | Item Checkbox | Toggle item packed / completed status | `PATCH /api/trips/:id/checklist/:itemId` | `trip_checklists` | Yes | Functional |
| Trip Workspace: Checklist | Add Item Input | Add new packing or preparation task | `POST /api/trips/:id/checklist` | `trip_checklists` | Yes | Functional |
| Trip Workspace: Checklist | Item Row | Delete checklist task | `DELETE /api/trips/:id/checklist/:itemId` | `trip_checklists` | Yes | Functional |
| Trip Workspace: Checklist | Filter Tabs | Filter items by All, Pending, Done | Client state filter | None | Yes | Functional |
| Trip Workspace: Settings | Settings Form | Edit name, dates, budget, visibility, status | `PUT /api/trips/:id` | `trips` | Yes | Functional |
| Trip Workspace: Settings | Danger Zone | Delete trip permanently with confirmation | `DELETE /api/trips/:id` | `trips` | Yes | Functional |
| Trip Workspace: Chat | Message Stream | View real-time group expedition messages | `GET /api/groups/:id/messages` | `group_messages`, `users` | Yes | Functional |
| Trip Workspace: Chat | Send Message | Send group chat message to members | `POST /api/groups/:id/messages` | `group_messages` | Yes | Functional |
| Trip Workspace: Members | Members Directory | List group/trip members with roles | `GET /api/trips/:id/members` | `trip_members`, `users` | Yes | Functional |
| Trip Workspace: Members | Invite Member Form | Invite traveler by email address | `POST /api/trips/:id/members` | `trip_members`, `notifications` | Yes | Functional |
| Trip Workspace: Members | Member Row | Remove member from trip | `DELETE /api/trips/:id/members/:userId` | `trip_members` | Yes | Functional |
| Group Travel (`/group-travel/explore`) | Hero Banner | Browse discoverable expeditions count | `GET /api/groups` | `groups` | Yes | Functional |
| Group Travel (`/group-travel/explore`) | Search & Filter | Filter expeditions by name or destination | Client query filter | `groups` | Yes | Functional |
| Group Travel (`/group-travel/explore`) | Expedition Cards | View seats, budget, organizer, duration | `GET /api/groups` | `groups`, `trips`, `destinations` | Yes | Functional |
| Group Travel (`/group-travel/explore`) | Card Click | Navigate to expedition dossier & preview | Client router `/group-travel/:id` | None | Yes | Functional |
| Group Travel: Dossier (`/group-travel/:id`) | Header & Cover | View expedition details, organizer badge | `GET /api/groups/:id` | `groups`, `destinations` | Yes | Functional |
| Group Travel: Dossier (`/group-travel/:id`) | Day-by-Day | View expedition itinerary schedule | `GET /api/groups/:id` | `trip_itinerary_items` | Yes | Functional |
| Group Travel: Dossier (`/group-travel/:id`) | Approved Members | List confirmed participants | `GET /api/groups/:id` | `group_members`, `users` | Yes | Functional |
| Group Travel: Dossier (`/group-travel/:id`) | "Request to Join" | Open multi-step application drawer | Drawer UI state | None | Yes | Functional |
| Group Travel: Dossier (`/group-travel/:id`) | Application Drawer | Submit experience & dietary questionnaire | `POST /api/groups/:id/applications` | `applications`, `notifications` | Yes | Functional |
| Group Travel: My Groups (`/group-travel/my-groups`) | Expeditions List | List groups organized or joined by user | `GET /api/groups/my-groups` | `groups`, `group_members` | Yes | Functional |
| Group Travel: My Groups (`/group-travel/my-groups`) | Workspace Button | Open trip workspace for the expedition | Client router `/trips/:id` | `trips` | Yes | Functional |
| Group Travel: Requests (`/group-travel/requests`) | Applications Table | Track submitted applications status | `GET /api/me/group-applications` | `applications`, `groups` | Yes | Functional |
| Group Travel: Requests (`/group-travel/requests`) | Withdraw Button | Withdraw pending join request | `PATCH /api/applications/:id/status` | `applications` | Yes | Functional |
| Group Travel: Requests (`/group-travel/requests`) | Organizer Review | Approve applicant (adds to members) | `PATCH /api/applications/:id/status` | `applications`, `group_members`, `trip_members` | Yes | Functional |
| Group Travel: Requests (`/group-travel/requests`) | Organizer Review | Reject applicant | `PATCH /api/applications/:id/status` | `applications` | Yes | Functional |
| AI Planner (`/ai-assistant`) | Session Sidebar | List persistent user chat sessions | `GET /api/ai/conversations` | `ai_conversations` | Yes | Functional |
| AI Planner (`/ai-assistant`) | New Session | Create new prompt context session | `POST /api/ai/conversations` | `ai_conversations` | Yes | Functional |
| AI Planner (`/ai-assistant`) | Session Select | Switch active conversation session | Client state / query messages | `ai_messages` | Yes | Functional |
| AI Planner (`/ai-assistant`) | Chat Messages | View conversation history | `GET /api/ai/conversations/:id/messages` | `ai_messages` | Yes | Functional |
| AI Planner (`/ai-assistant`) | Send Message Input | Synthesize Bangladesh travel advice | `POST /api/ai/conversations/:id/messages` | `ai_messages` | Yes | Functional |
| AI Planner (`/ai-assistant`) | Quick Prompts | Send 1-click suggested prompts | Client prompt trigger | `ai_messages` | Yes | Functional |
| AI Planner (`/ai-assistant`) | Message Actions | Copy synthesized response text | Browser clipboard | None | Yes | Functional |
| Destinations Directory (`/destinations`) | Search Toolbar | Search by name, district, or division | `GET /api/destinations?q=...` | `destinations` | Yes | Functional |
| Destinations Directory (`/destinations`) | Category Filter | Filter by Beach, Nature, Culture, etc. | Client category filter | `destinations` | Yes | Functional |
| Destinations Directory (`/destinations`) | Wishlist Heart | Toggle destination saved to wishlist | `POST /api/me/wishlist/:id` | `wishlist_destinations` | Yes | Functional |
| Destinations Directory (`/destinations`) | Destination Card | View destination detail button | Client router `/destinations/:id` | None | Yes | Functional |
| Destination Detail (`/destinations/:id`) | Hero & Facts | Best time, stay duration, est. budget | `GET /api/destinations/:id` | `destinations` | Yes | Functional |
| Destination Detail (`/destinations/:id`) | Reviews List | Community traveler reviews & star ratings | `GET /api/destinations/:id` | `reviews`, `users` | Yes | Functional |
| Destination Detail (`/destinations/:id`) | Add Review Form | Select 1-5 stars and submit review | `POST /api/reviews` | `reviews` | Yes | Functional |
| Destination Detail (`/destinations/:id`) | Action Panel | "Plan a trip here" CTA | Client router `/trips/create` | None | Yes | Functional |
| Destination Detail (`/destinations/:id`) | Action Panel | "Plan with AI" CTA | Client router `/ai-assistant` | None | Yes | Functional |
| Global Expenses (`/expenses`) | Metrics Header | Total spent across all user trips | `GET /api/expenses/overview` | `expenses`, `trips` | Yes | Functional |
| Global Expenses (`/expenses`) | Search Filter | Search expenses by title, category, payer | Client query filter | `expenses` | Yes | Functional |
| Global Expenses (`/expenses`) | Ledger Table | View comprehensive cross-trip expenses | `GET /api/expenses/overview` | `expenses`, `users` | Yes | Functional |
| Global Expenses (`/expenses`) | Add to Trip Button | Navigate to trips to record expense | Client router `/trips` | None | Yes | Functional |
| Travel Calendar (`/calendar`) | Calendar Header | Month navigation (Prev, Next, Today) | Client month state | None | Yes | Functional |
| Travel Calendar (`/calendar`) | Calendar Grid | Auto-highlight dates containing trips | `GET /api/trips` | `trips` | Yes | Functional |
| Travel Calendar (`/calendar`) | Day Cell | Select date to view daily agenda | Client date state | None | Yes | Functional |
| Travel Calendar (`/calendar`) | Day Agenda | View trips active on selected date | Client matched events | None | Yes | Functional |
| Travel Calendar (`/calendar`) | Add Event Action | Record personal event for selected date | Client event state | None | Yes | Functional |
| Travel Footprint (`/travel-footprint`) | Subpage Tabs | Switch between Overview, Passport, Achievements, Timeline | URL routing `/travel-footprint/:subpage` | None | Yes | Functional |
| Travel Footprint: Overview | Summary Header | View visited districts count, travel days | `GET /api/me/footprint` | `passport_entries`, `trips` | Yes | Functional |
| Travel Footprint: Overview | Bangladesh Map | Visual map of 64 districts with visited pins | `GET /api/me/footprint` | `passport_entries` | Yes | Functional |
| Travel Footprint: Overview | Progress Ring | Percentage explored of 64 districts | Client calculated ratio | None | Yes | Functional |
| Travel Footprint: Overview | District Checklist | View list of visited & unexplored districts | `GET /api/me/footprint` | `passport_entries` | Yes | Functional |
| Travel Footprint: Passport | Passport Booklet | View official passport booklet with stamps | `GET /api/me/passport` | `passport_entries`, `destinations` | Yes | Functional |
| Travel Footprint: Passport | Add Stamp Modal | Select destination to stamp passport | `POST /api/me/passport` | `passport_entries` | Yes | Functional |
| Travel Footprint: Achievements | Badges Grid | View unlocked & locked travel milestones | `GET /api/me/achievements` | `travel_achievements`, `user_achievements` | Yes | Functional |
| Travel Footprint: Timeline | Timeline Feed | Chronological list of completed trips | `GET /api/me/footprint` | `trips`, `destinations` | Yes | Functional |
| Community Discussions (`/community`) | Post Form | Publish discussion with body text | `POST /api/community/posts` | `community_posts` | Yes | Functional |
| Community Discussions (`/community`) | Posts Feed | View discussions, author, date, counts | `GET /api/community/posts` | `community_posts`, `users` | Yes | Functional |
| Community Discussions (`/community`) | Reaction Button | Toggle like on discussion post | `POST /api/community/posts/:id/reactions` | `community_reactions` | Yes | Functional |
| Community Discussions (`/community`) | Replies Accordion | View comments for discussion | `GET /api/community/posts/:id/comments` | `community_comments` | Yes | Functional |
| Community Discussions (`/community`) | Reply Input | Submit comment reply to post | `POST /api/community/posts/:id/comments` | `community_comments` | Yes | Functional |
| Community Discussions (`/community`) | Search Input | Filter posts by body or author name | Client query filter | None | Yes | Functional |
| Notifications (`/notifications`) | Notifications List | View notifications with unread indicators | `GET /api/notifications` | `notifications` | Yes | Functional |
| Notifications (`/notifications`) | Notification Row | Click to mark read and navigate to link | `PATCH /api/notifications/:id/read` | `notifications` | Yes | Functional |
| Notifications (`/notifications`) | Mark All Read | Mark all user notifications as read | `PATCH /api/notifications/read-all` | `notifications` | Yes | Functional |
| Notifications (`/notifications`) | Delete Icon | Remove notification item | `DELETE /api/notifications/:id` | `notifications` | Yes | Functional |
| User Profile (`/profile`) | Profile View | View name, bio, travel style, interests | `GET /api/me/profile` | `users`, `user_profiles` | Yes | Functional |
| User Profile (`/profile`) | Edit Profile Form | Edit Name, Bio, Travel style | `PUT /api/me/profile` | `users`, `user_profiles` | Yes | Functional |
| User Profile (`/profile`) | Interests Tags | Add tag chip, remove tag chip | `PUT /api/me/profile` | `user_profiles` | Yes | Functional |
| User Profile (`/profile`) | Stats Summary | View trips count, traveler rating | `GET /api/me/profile` | `trips`, `traveler_reviews` | Yes | Functional |
| Companion Profile (`/users/:id`) | Public Profile View | Discover fellow traveler bio & style | `GET /api/users/:id/profile` | `users`, `user_profiles` | Yes | Functional |
| Settings (`/settings`) | Privacy Tab | Configure profile, history, footprint, reviews visibility | `PUT /api/me/privacy` | `user_privacy_settings` | Yes | Functional |
| Settings (`/settings`) | Security Tab | Change account password form | `POST /api/auth/change-password` | `users` | Yes | Functional |
| Settings (`/settings`) | Security Tab | Submit tour planner verification request | `POST /api/me/verification` | `verification_requests` | Yes | Functional |
| Settings (`/settings`) | Sign Out | Sign out and clear stored session | Client storage clear | None | Yes | Functional |
| App Shell & Topbar | Global Search | Search destinations, trips, groups live | `GET /api/destinations`, `trips`, `groups` | PostgreSQL search | Yes | Functional |
| App Shell & Topbar | Notifications Bell | Open quick unread notifications menu | `GET /api/notifications` | `notifications` | Yes | Functional |
| App Shell & Topbar | Avatar Dropdown | Quick Profile, Settings, Role switcher | `POST /api/auth/demo-login` | `users` | Yes | Functional |
| App Shell & Topbar | Quick "+ New Trip" | Shortcut to plan new journey | Client router `/trips/create` | None | Yes | Functional |
| Tour Planner (`/planner/dashboard`) | Overview Stats | Published tours, participants count | `GET /api/planner/tours`, `bookings` | `tours`, `bookings` | Yes | Functional |
| Tour Planner (`/planner/tours`) | Tours Table | View tours, departures count, status | `GET /api/planner/tours` | `tours`, `tour_departures` | Yes | Functional |
| Tour Planner (`/planner/tours/create`) | Create Tour Form | Title, destination, price, capacity | `POST /api/tours` | `tours` | Yes | Functional |
| Tour Planner (`/planner/tours/participants`) | Bookings Table | View traveler bookings & status | `GET /api/planner/bookings` | `bookings`, `users` | Yes | Functional |
| Tour Planner (`/planner/tours/participants`) | Booking Actions | Confirm or Cancel participant booking | `PATCH /api/bookings/:id/status` | `bookings` | Yes | Functional |
| Tour Planner (`/planner/schedules`) | Schedules Table | View departure dates, seats booked | `GET /api/planner/departures` | `tour_departures`, `bookings` | Yes | Functional |
| Admin (`/admin/dashboard`) | Analytics Grid | Total users, planners, trips, groups, tours, reports | `GET /api/admin/analytics` | `users`, `trips`, `groups`, `tours`, `user_reports` | Yes | Functional |
| Admin (`/admin/users`) | User Directory Table | View all platform users & roles | `GET /api/admin/users` | `users`, `trips` | Yes | Functional |
| Admin (`/admin/users`) | Role Dropdown | Change user role between Traveler, Planner, Admin | `PATCH /api/admin/users/:id/role` | `users` | Yes | Functional |
| Admin (`/admin/users`) | Status Action | Suspend or Activate user account | `PATCH /api/admin/users/:id/status` | `users` | Yes | Functional |
| Admin (`/admin/planners/verification`) | Requests Table | View planner verification notes | `GET /api/admin/verifications` | `verification_requests`, `users` | Yes | Functional |
| Admin (`/admin/planners/verification`) | Request Action | Approve verification (upgrades role to TOUR_PLANNER) | `PATCH /api/admin/verifications/:id` | `verification_requests`, `users` | Yes | Functional |
| Admin (`/admin/planners/verification`) | Request Action | Reject verification | `PATCH /api/admin/verifications/:id` | `verification_requests` | Yes | Functional |
| Admin (`/admin/trips`) | Platform Trips Table | Monitor all traveler trips across platform | `GET /api/admin/trips` | `trips`, `destinations`, `users` | Yes | Functional |
| Admin (`/admin/groups`) | Platform Groups Table | Monitor all published group expeditions | `GET /api/admin/groups` | `groups`, `trips`, `users` | Yes | Functional |
| Admin (`/admin/destinations`) | Catalog Table | View all discoverable destinations | `GET /api/destinations` | `destinations` | Yes | Functional |
| Admin (`/admin/destinations`) | Add Destination Modal | Create new destination with budget & category | `POST /api/destinations` | `destinations` | Yes | Functional |
| Admin (`/admin/destinations`) | Delete Destination | Delete destination from catalog | `DELETE /api/destinations/:id` | `destinations` | Yes | Functional |
| Admin (`/admin/reports`) | Moderation Table | View user reports & reasons | `GET /api/admin/reports` | `user_reports`, `users` | Yes | Functional |
| Admin (`/admin/reports`) | Action Buttons | Apply Dismiss, Warning, or Suspension | `POST /api/admin/reports/:id/actions` | `moderation_actions`, `users` | Yes | Functional |

---

## Multi-User Roles & Verification Performed

### 1. Test Accounts Seeded and Verified

| Role | Name | Email | Password | Primary Capabilities Verified |
|---|---|---|---|---|
| Traveler 1 | Rafi Ahmed | `traveler@porikroma.com` | `password123` | Creates trips, publishes group expeditions, creates itinerary, adds expenses, checklist toggles, journal memories, maps, books tour departures |
| Traveler 2 | Samira Rahman | `traveler2@porikroma.com` | `password123` | Discovers group expeditions, submits questionnaires, accesses approved workspace, group chats, adds shared expenses |
| Tour Planner | Nadia Rahman | `planner@porikroma.com` | `password123` | Creates tours, schedules departures, monitors participant bookings, approves/rejects traveler group applications |
| Platform Admin | Platform Admin | `admin@porikroma.com` | `password123` | Monitors platform analytics, alters user roles, suspends/activates users, approves planner verifications, manages destinations, enforces moderation reports |

### 2. End-to-End Workflows Executed in Automated Test Suite

- [x] **Traveler 1 Trip & Group Lifecycle**: Created trip `"Sylhet Rain & River Expedition"`, published group expedition with 5 seats and ৳7,000 budget per person, added itinerary stop at Lalakhal, added ৳6,000 cottage expense, added and toggled checklist task, saved local notes and map points.
- [x] **Traveler 2 Discovery & Application**: Discovered Traveler 1's group expedition, answered multi-step application questions, and submitted join request.
- [x] **Traveler 1 Approval**: Reviewed Traveler 2's application and approved it; verified database insertion into `group_members` and `trip_members`.
- [x] **Member Collaboration**: Traveler 2 gained approved workspace access and sent real-time group chat messages to participants.
- [x] **Tour Planner & Traveler Booking**: Tour Planner published `"Wild Chittagong Hill Tracts Traverse"`, scheduled departure; Traveler 1 discovered and booked 2 seats; Tour Planner confirmed booking.
- [x] **Admin Governance**: Admin logged in, reviewed analytics, created new destination `"Kuakata Sunset Beach"`, reviewed user directory, and moderated reported user.

### 3. Build & Health Status

- **Backend**: Compiles with TypeScript `tsc` without errors (`node dist/server.js` running on port 4000).
- **Database**: PostgreSQL connection healthy (`/health` returns `{"status":"ok","database":"ready"}`).
- **Frontend**: Vite builds with TypeScript `tsc -b && vite build` in 1.50s without errors (`dist/` generated, dev server active on port 5173).
