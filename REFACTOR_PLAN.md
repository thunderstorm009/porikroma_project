# Porikroma Frontend Refactor Plan: App.tsx Modularization

This document provides a comprehensive audit of `Frontend/src/App.tsx` (4,394 lines) and defines the exact target architecture, component mapping, global context design, and extraction sequence.

---

## 1. Target Directory Structure

```
Frontend/src/
├── api.ts                                # Existing HTTP client
├── main.tsx                              # Application entry point
├── styles.css                            # Complete CSS stylesheet
├── routes.tsx                            # Centralized React Router configuration
├── types/
│   └── index.ts                          # Domain entities, roles, and API payload contracts
├── utils/
│   ├── formatters.ts                     # Currency (BDT), date, and relative time helpers
│   └── storage.ts                        # Type-safe localStorage access (tokens, roles)
├── context/
│   ├── AuthContext.tsx                   # User profile, JWT, role, login/register/logout
│   └── NotificationsContext.tsx          # Real-time alert feed and unread count badge
├── hooks/
│   ├── useAuth.ts                        # AuthContext consumer hook
│   ├── useNotifications.ts               # NotificationsContext consumer hook
│   └── useDebounce.ts                    # Search input debouncing
├── components/
│   ├── common/
│   │   ├── PageHeader.tsx                # Standard page header with eyebrow & action slot
│   │   ├── Modal.tsx                     # Reusable modal backdrop and dialog frame
│   │   └── StatusBadge.tsx               # Reusable status indicator pills
│   ├── layout/
│   │   ├── RouteFrame.tsx                # App shell, navigation sidebar, topbar
│   │   ├── ProtectedLayout.tsx           # Auth boundary wrapping traveler routes
│   │   ├── RoleGuard.tsx                 # Permission boundary for Planner & Admin
│   │   ├── RoleFrame.tsx                 # Dedicated sidebar layout for Planner & Admin
│   │   └── GlobalSearchModal.tsx         # ⌘K / Ctrl+K live search modal
│   └── workspace/                        # Trip workspace sub-tabs
│       ├── ItineraryTab.tsx              # Day-by-day stops and activities
│       ├── ExpensesTab.tsx               # Trip budget ledger & settlements
│       ├── NotesTab.tsx                  # Shared expedition notes feed
│       ├── JournalTab.tsx                # Travel memories & reflection feed
│       ├── MapTab.tsx                    # Destination points of interest & map pins
│       ├── ChecklistTab.tsx              # Packing list items & completion toggle
│       ├── SettingsTab.tsx               # Trip name, dates, status, budget, danger zone
│       ├── GroupChatTab.tsx              # Group participant chat stream
│       └── MembersTab.tsx                # Participant roster & email invitations
└── pages/
    ├── public/
    │   ├── PublicLanding.tsx             # "/" Landing hero & feature highlights
    │   └── AuthPage.tsx                  # "/login", "/register", "/forgot-password", etc.
    ├── traveler/
    │   ├── DashboardPage.tsx             # "/dashboard" Overview metrics & recommendations
    │   ├── TripsPage.tsx                 # "/trips" Personal trips directory
    │   ├── CreateTrip.tsx                # "/trips/create" Solo vs Group planner form
    │   ├── TripWorkspace.tsx             # "/trips/:tripId/*" Multi-tab workspace container
    │   ├── GroupExplore.tsx              # "/group-travel/explore" Discoverable expeditions
    │   ├── GroupDetailsPage.tsx          # "/group-travel/:groupId" Expedition dossier & apply
    │   ├── MyGroupsPage.tsx              # "/group-travel/my-groups" Joined/organized list
    │   ├── GroupRequestsPage.tsx         # "/group-travel/requests" Organizer review table
    │   ├── PlannerPage.tsx               # "/ai-assistant" AI travel copilot chat
    │   ├── DestinationsPage.tsx          # "/destinations" 64-district catalog & search
    │   ├── DestinationDetails.tsx        # "/destinations/:destinationId" Detail & reviews
    │   ├── ExpensesPage.tsx              # "/expenses" Cross-trip global financial ledger
    │   ├── CalendarPage.tsx              # "/calendar" Monthly travel agenda
    │   ├── FootprintPage.tsx             # "/travel-footprint/*" 64-district footprint & passport
    │   ├── CommunityPage.tsx             # "/community" Discussion feed, replies, likes
    │   ├── NotificationsPage.tsx         # "/notifications" Alerts center & read management
    │   ├── ProfilePage.tsx               # "/profile" & "/users/:userId" Traveler public/private bio
    │   └── SettingsPage.tsx              # "/settings" Privacy switches & verification request
    ├── planner/
    │   ├── PlannerDashboard.tsx          # "/planner/dashboard" Operator stats & departures
    │   ├── CreateTourPage.tsx            # "/planner/tours/create" Tour builder form
    │   ├── PlannerToursList.tsx          # "/planner/tours" Operator packages catalog
    │   ├── PlannerParticipants.tsx       # "/planner/tours/participants" Bookings management
    │   └── PlannerSchedules.tsx          # "/planner/schedules" Departure calendar
    └── admin/
        ├── AdminDashboard.tsx            # "/admin/dashboard" High-level platform statistics
        ├── AdminUsers.tsx                # "/admin/users" User directory, roles & status
        ├── AdminVerifications.tsx        # "/admin/planners" Operator verification queue
        ├── AdminTrips.tsx                # "/admin/trips" Platform-wide trips monitor
        ├── AdminGroups.tsx               # "/admin/groups" Published expeditions monitor
        ├── AdminDestinations.tsx         # "/admin/destinations" Destination catalog manager
        └── AdminReports.tsx              # "/admin/reports" Content & user safety moderation
```

---

## 2. Item-by-Item Mapping from `App.tsx` (100% Coverage)

| Line Range in `App.tsx` | Item / Component / Type | Description / Responsibility | Target File Destination |
|---|---|---|---|
| **13** | `type PlatformRole` | `'TRAVELER' \| 'TOUR_PLANNER' \| 'ADMIN'` | `src/types/index.ts` |
| **15–20** | `interface User` | User identity contract (`id`, `name`, `email`, `role`) | `src/types/index.ts` |
| **22–33** | `interface Destination` | Destination catalog contract with budget, rating, image | `src/types/index.ts` |
| **35–50** | `interface Trip` | Trip entity contract with dates, budget, member count | `src/types/index.ts` |
| **52–68** | `interface GroupExpedition` | Published group entity with capacity and pricing | `src/types/index.ts` |
| **70–77** | `interface NotificationItem` | Notification item contract with unread state | `src/types/index.ts` |
| **79–90** | `function PageHeader` | Reusable title, eyebrow, and top-right action wrapper | `src/components/common/PageHeader.tsx` |
| **95–115** | `function PublicLanding` | Public homepage with branding and landing copy | `src/pages/public/PublicLanding.tsx` |
| **120–315** | `function AuthPage` | Login, registration, password recovery, reset, verify | `src/pages/public/AuthPage.tsx` |
| **317–320** | `function ProtectedLayout` | Auth guard redirecting unauthenticated users to `/login` | `src/components/layout/ProtectedLayout.tsx` |
| **322–577** | `function RouteFrame` | App shell, navigation sidebar, topbar, user menu, search modal | `src/components/layout/RouteFrame.tsx` |
| **548–574** | Global search sub-view in `RouteFrame` | Modal for searching destinations, trips, and groups live | `src/components/layout/GlobalSearchModal.tsx` |
| **582–766** | `function DashboardPage` | Traveler dashboard, stats cards, upcoming trips, weather, picks | `src/pages/traveler/DashboardPage.tsx` |
| **771–873** | `function TripsPage` | Trips directory with filter tabs, query search, delete | `src/pages/traveler/TripsPage.tsx` |
| **875–1029** | `function CreateTrip` | Journey builder supporting Solo vs Group expedition modes | `src/pages/traveler/CreateTrip.tsx` |
| **1033–1043** | `interface WorkspaceData` | Aggregated payload contract for full trip workspace | `src/types/index.ts` |
| **1045–1226** | `function TripWorkspace` | Workspace coordinator, hero banner, and 8+ tab router | `src/pages/traveler/TripWorkspace.tsx` |
| **1228–1293** | `function ItineraryTab` | Daily itinerary items list, add stop modal, delete stop | `src/components/workspace/ItineraryTab.tsx` |
| **1295–1480** | `function ExpensesTab` | Budget utilization gauge, expense ledger, add expense, settlements | `src/components/workspace/ExpensesTab.tsx` |
| **1482–1536** | `function NotesTab` | Shared trip notes feed, author badges, add note form | `src/components/workspace/NotesTab.tsx` |
| **1538–1586** | `function JournalTab` | Personal/group memories feed and reflection recorder | `src/components/workspace/JournalTab.tsx` |
| **1588–1664** | `function MapTab` | Pinned destination POIs, category tags, add place modal | `src/components/workspace/MapTab.tsx` |
| **1666–1736** | `function ChecklistTab` | Packing checklist items, completion checkboxes, add task | `src/components/workspace/ChecklistTab.tsx` |
| **1738–1818** | `function SettingsTab` | Trip metadata form, budget, status transitions, delete trip | `src/components/workspace/SettingsTab.tsx` |
| **1820–1868** | `function GroupChatTab` | Expedition participant chat stream, message composer | `src/components/workspace/GroupChatTab.tsx` |
| **1870–1929** | `function MembersTab` | Trip members roster, email invite form, remove participant | `src/components/workspace/MembersTab.tsx` |
| **1932–2026** | `function GroupExplore` | Discoverable small-group expeditions directory & search | `src/pages/traveler/GroupExplore.tsx` |
| **2028–2197** | `function GroupDetailsPage` | Group dossier, day-by-day preview, application drawer | `src/pages/traveler/GroupDetailsPage.tsx` |
| **2199–2248** | `function MyGroupsPage` | List of expeditions organized or joined by current user | `src/pages/traveler/MyGroupsPage.tsx` |
| **2250–2321** | `function GroupRequestsPage` | Application review queue, approve/reject/withdraw status | `src/pages/traveler/GroupRequestsPage.tsx` |
| **2323–2489** | `function PlannerPage` | AI travel assistant, persistent chat sessions, quick prompts | `src/pages/traveler/PlannerPage.tsx` |
| **2491–2564** | `function DestinationsPage` | 64-district destination catalog, category filter, wishlist | `src/pages/traveler/DestinationsPage.tsx` |
| **2566–2695** | `function DestinationDetails` | Detailed destination dossier, fact sheet, community reviews | `src/pages/traveler/DestinationDetails.tsx` |
| **2697–2787** | `function ExpensesPage` | Cross-trip financial overview, category charts, ledger table | `src/pages/traveler/ExpensesPage.tsx` |
| **2789–2904** | `function Calendar` | Monthly calendar grid, trip date markers, day agenda, events | `src/pages/traveler/CalendarPage.tsx` |
| **2906–3123** | `function Footprint` | 64-district footprint overview, passport booklet, achievements, timeline | `src/pages/traveler/FootprintPage.tsx` |
| **3125–3246** | `function CommunityPage` | Community feed, publish discussion, like reactions, replies | `src/pages/traveler/CommunityPage.tsx` |
| **3248–3310** | `function NotificationsPage` | User notifications center, mark single/all read, delete alert | `src/pages/traveler/NotificationsPage.tsx` |
| **3312–3426** | `function ProfilePage` | Traveler identity, bio, travel style, interests tag editor | `src/pages/traveler/ProfilePage.tsx` |
| **3428–3526** | `function SettingsPage` | Visibility & privacy controls, change password, planner verification | `src/pages/traveler/SettingsPage.tsx` |
| **3528–3535** | `function RoleGuard` | Access guard enforcing role restrictions | `src/components/layout/RoleGuard.tsx` |
| **3537–3597** | `function RoleFrame` | Sidebar shell for Tour Planner and Platform Admin operations | `src/components/layout/RoleFrame.tsx` |
| **3599–3689** | `function PlannerDashboard` | Tour planner ops overview, tours count, participant bookings | `src/pages/planner/PlannerDashboard.tsx` |
| **3691–3742** | `function CreateTourPage` | Commercial tour package builder form with pricing and days | `src/pages/planner/CreateTourPage.tsx` |
| **3744–3788** | `function PlannerToursList` | Catalog of tours published by the logged-in tour planner | `src/pages/planner/PlannerToursList.tsx` |
| **3790–3840** | `function PlannerParticipants` | Traveler bookings list with confirm and cancel actions | `src/pages/planner/PlannerParticipants.tsx` |
| **3842–3883** | `function PlannerSchedules` | Scheduled departure calendar and seat availability | `src/pages/planner/PlannerSchedules.tsx` |
| **3885–3952** | `function AdminDashboard` | Platform analytics cards, metrics overview, user reports queue | `src/pages/admin/AdminDashboard.tsx` |
| **3954–4018** | `function AdminUsers` | Platform users table, role switcher, suspend/activate action | `src/pages/admin/AdminUsers.tsx` |
| **4020–4070** | `function AdminVerifications` | Planner verification requests queue, approve/reject actions | `src/pages/admin/AdminVerifications.tsx` |
| **4072–4105** | `function AdminTrips` | Platform-wide trip monitoring ledger | `src/pages/admin/AdminTrips.tsx` |
| **4107–4140** | `function AdminGroups` | Published group expeditions monitoring ledger | `src/pages/admin/AdminGroups.tsx` |
| **4142–4232** | `function AdminDestinations` | Destination catalog manager, add destination modal, delete | `src/pages/admin/AdminDestinations.tsx` |
| **4234–4287** | `function AdminReports` | Safety moderation queue, apply dismiss/warning/suspension | `src/pages/admin/AdminReports.tsx` |
| **4292–4394** | `function App` | Complete BrowserRouter and Route hierarchy | `src/routes.tsx` & `src/App.tsx` |

---

## 3. Global Context Identification & API Design

Currently, session state and alerts are stored in disconnected local states and `localStorage` reads. Extracting these into dedicated React Contexts eliminates duplication and state desynchronization.

### Context 1: `AuthContext` (`src/context/AuthContext.tsx`)
Manages the authenticated user identity, JWT token, active role, and authentication status.

- **State Exposed**:
  - `user: User | null` — Current authenticated user object.
  - `token: string | null` — Bearer JWT token from `localStorage.getItem('porikroma-token')`.
  - `role: PlatformRole | null` — Current active role (`TRAVELER`, `TOUR_PLANNER`, `ADMIN`).
  - `isAuthenticated: boolean` — True if valid token and user exist.
  - `isLoading: boolean` — True while validating initial session on app mount.
- **Actions Exposed**:
  - `login: (credentials: { email: string; password: string }) => Promise<void>`
  - `register: (data: { name: string; email: string; password: string; role: PlatformRole }) => Promise<void>`
  - `demoLogin: (role: PlatformRole) => Promise<void>` — One-click role switching with token and state refresh.
  - `logout: () => void` — Clears tokens and redirects to `/login`.
  - `updateUser: (updatedUser: Partial<User>) => void` — Optimistically updates user state.

### Context 2: `NotificationsContext` (`src/context/NotificationsContext.tsx`)
Manages the global notifications feed, real-time unread counter badge, and alert read states.

- **State Exposed**:
  - `notifications: NotificationItem[]` — Array of notification objects.
  - `unreadCount: number` — Count of unread notifications (`!item.read`).
  - `isLoading: boolean` — True while fetching alerts.
- **Actions Exposed**:
  - `refreshNotifications: () => Promise<void>` — Reloads alerts from `/api/notifications`.
  - `markAsRead: (id: string, link?: string) => Promise<void>` — Marks single notification read and optionally navigates.
  - `markAllAsRead: () => Promise<void>` — Calls `PATCH /api/notifications/read-all`.
  - `deleteNotification: (id: string) => Promise<void>` — Calls `DELETE /api/notifications/:id`.

---

## 4. Order of Extraction (Least Dependent First)

To guarantee that TypeScript builds succeed continuously and no circular dependencies occur, extraction must follow this exact bottom-up sequence:

```
Step 1: Types & Utility Contracts (Zero dependencies)
   ├── src/types/index.ts
   └── src/utils/formatters.ts

Step 2: Global State Providers (Depends only on types and api.ts)
   ├── src/context/AuthContext.tsx
   ├── src/hooks/useAuth.ts
   ├── src/context/NotificationsContext.tsx
   └── src/hooks/useNotifications.ts

Step 3: Common UI Elements (Depends only on types and lucide-react)
   └── src/components/common/PageHeader.tsx

Step 4: Layout & Shell Components (Depends on AuthContext, NotificationsContext, PageHeader)
   ├── src/components/layout/GlobalSearchModal.tsx
   ├── src/components/layout/RouteFrame.tsx
   ├── src/components/layout/ProtectedLayout.tsx
   ├── src/components/layout/RoleGuard.tsx
   └── src/components/layout/RoleFrame.tsx

Step 5: Trip Workspace Sub-Tabs (Isolated tab components)
   ├── src/components/workspace/ItineraryTab.tsx
   ├── src/components/workspace/ExpensesTab.tsx
   ├── src/components/workspace/NotesTab.tsx
   ├── src/components/workspace/JournalTab.tsx
   ├── src/components/workspace/MapTab.tsx
   ├── src/components/workspace/ChecklistTab.tsx
   ├── src/components/workspace/SettingsTab.tsx
   ├── src/components/workspace/GroupChatTab.tsx
   └── src/components/workspace/MembersTab.tsx

Step 6: Standalone Traveler & Public Pages
   ├── src/pages/public/PublicLanding.tsx
   ├── src/pages/public/AuthPage.tsx
   ├── src/pages/traveler/NotificationsPage.tsx
   ├── src/pages/traveler/ProfilePage.tsx
   ├── src/pages/traveler/SettingsPage.tsx
   ├── src/pages/traveler/DestinationsPage.tsx
   ├── src/pages/traveler/DestinationDetails.tsx
   ├── src/pages/traveler/ExpensesPage.tsx
   ├── src/pages/traveler/CalendarPage.tsx
   ├── src/pages/traveler/FootprintPage.tsx
   └── src/pages/traveler/CommunityPage.tsx

Step 7: Complex Traveler Pages & AI Planner
   ├── src/pages/traveler/DashboardPage.tsx
   ├── src/pages/traveler/TripsPage.tsx
   ├── src/pages/traveler/CreateTrip.tsx
   ├── src/pages/traveler/TripWorkspace.tsx (assembles all 9 tabs)
   ├── src/pages/traveler/GroupExplore.tsx
   ├── src/pages/traveler/GroupDetailsPage.tsx
   ├── src/pages/traveler/MyGroupsPage.tsx
   ├── src/pages/traveler/GroupRequestsPage.tsx
   └── src/pages/traveler/PlannerPage.tsx (AI Assistant)

Step 8: Tour Planner & Admin Pages
   ├── src/pages/planner/PlannerDashboard.tsx
   ├── src/pages/planner/CreateTourPage.tsx
   ├── src/pages/planner/PlannerToursList.tsx
   ├── src/pages/planner/PlannerParticipants.tsx
   ├── src/pages/planner/PlannerSchedules.tsx
   ├── src/pages/admin/AdminDashboard.tsx
   ├── src/pages/admin/AdminUsers.tsx
   ├── src/pages/admin/AdminVerifications.tsx
   ├── src/pages/admin/AdminTrips.tsx
   ├── src/pages/admin/AdminGroups.tsx
   ├── src/pages/admin/AdminDestinations.tsx
   └── src/pages/admin/AdminReports.tsx

Step 9: Routing Assembly & App Root
   ├── src/routes.tsx (Declarative route hierarchy)
   └── src/App.tsx (Context providers + Router root, reduced from 4,394 to ~50 lines)
```
