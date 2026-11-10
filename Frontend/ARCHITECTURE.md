# Porikroma Frontend Architecture

Porikroma is a modern travel planning and group expedition platform for Bangladesh.
The frontend is built with **React 19**, **TypeScript**, **Vite**, and **React Router 7**.

---

## 1. Directory Structure

```text
Frontend/src/
├── api/                       # Centralized typed API service layer
│   ├── client.ts              # Core fetch wrapper with JWT header & error handling
│   ├── auth.ts                # Session, credentials, password recovery & user profile
│   ├── trips.ts               # Personal trips, itinerary, POIs, notes & checklist
│   ├── destinations.ts        # Destination catalog, wishlist & reviews
│   ├── groups.ts              # Small-group expeditions, applications & chat
│   ├── expenses.ts            # Spending ledger, settlements & category metrics
│   ├── planner.ts             # AI copilot sessions & tour operator workflows
│   ├── admin.ts               # Platform stats, users, verifications & moderation
│   ├── community.ts           # Discussions, comments & reactions
│   ├── notifications.ts       # Alert feed & unread counter
│   ├── footprint.ts           # 64-district exploration & passport stamps
│   └── index.ts               # Unified API re-export
├── api.ts                     # Backward-compatible API entry point
├── components/
│   ├── common/                # Reusable presentation widgets (PageHeader, Modal, StatusBadge, EmptyState)
│   ├── layout/                # Shell frames & guards (RouteFrame, RoleFrame, ProtectedLayout, RoleGuard, GlobalSearchModal)
│   └── workspace/             # Modular sub-tabs for trip workspace (ItineraryTab, ExpensesTab, MapTab, etc.)
├── context/
│   ├── AuthContext.tsx        # User identity, JWT token, role switcher, and login/logout state
│   └── NotificationsContext.tsx# Real-time alert feed and unread counter badge
├── hooks/
│   ├── useAuth.ts             # Convenience hook for AuthContext
│   └── useNotifications.ts    # Convenience hook for NotificationsContext
├── pages/
│   ├── public/                # Public landing page (/) and authentication views (/login, /register, etc.)
│   ├── traveler/              # Traveler dashboard, trips, expeditions, destinations, footprint, settings
│   ├── planner/               # Tour operator dashboard, tour builder, bookings & schedules
│   └── admin/                 # Platform administration, user control, verifications & moderation
├── types/
│   └── index.ts               # Shared domain entities, role enums, and API payloads
├── utils/
│   ├── formatters.ts          # Pure helpers (formatBDT, formatDate, getInitials, etc.)
│   └── storage.ts             # Type-safe localStorage access
├── routes.tsx                 # Central React Router configuration with lazy loading & Suspense
├── App.tsx                    # Minimal application shell (Providers + Router root)
├── main.tsx                   # Application DOM mount
└── styles.css                 # Complete responsive design tokens and styling
```

---

## 2. Where and How to Add New Pages

To add a new feature page to Porikroma:

### Step 1: Create the Page Component
Create your component file in the appropriate domain folder inside `src/pages/`:
- Traveler features: `src/pages/traveler/YourNewPage.tsx`
- Tour planner features: `src/pages/planner/YourNewPage.tsx`
- Admin features: `src/pages/admin/YourNewPage.tsx`
- Public or auth features: `src/pages/public/YourNewPage.tsx`

Use named and default exports:
```tsx
import { PageHeader } from '../../components/common/PageHeader'

export function YourNewPage() {
  return (
    <div className="page">
      <PageHeader
        eyebrow="Category Eyebrow"
        title="Page Title"
        description="Brief explanation of what the user can do here."
      />
      {/* Page content */}
    </div>
  )
}

export default YourNewPage
```

### Step 2: Register the Route in `src/routes.tsx`
1. For admin or heavy pages, lazy load the component:
   ```tsx
   const YourNewPage = lazy(() => import('./pages/admin/YourNewPage'))
   ```
2. Add the `<Route>` definition inside the respective guard layout:
   - For protected traveler routes, place inside `<Route element={<ProtectedLayout />}>`.
   - For planner routes, place inside the `/planner/*` route tree.
   - For admin routes, place inside the `/admin/*` route tree.

### Step 3: Add Navigation Links
If the page should appear in navigation:
- Traveler sidebar: Add entry to `links` array in [`src/components/layout/RouteFrame.tsx`](file:///home/axoril/porikroma_project/Frontend/src/components/layout/RouteFrame.tsx).
- Planner / Admin sidebar: Add entry to navigation in [`src/components/layout/RoleFrame.tsx`](file:///home/axoril/porikroma_project/Frontend/src/components/layout/RoleFrame.tsx).

### Step 4: Add API Client Calls
Define any new endpoints in `src/api/<feature>.ts` using the shared `api<T>()` request helper.

---

## 3. Code Splitting & Performance Guidelines

- Heavy or role-specific pages (Admin, Tour Planner, AI Copilot, Bangladesh Footprint Map) are lazy-loaded via `React.lazy()` and wrapped in `<Suspense>` in `src/routes.tsx`.
- Core traveler pages (Dashboard, Trips, Explore) are loaded directly to ensure instant initial render.
- Keep components focused and single-purpose; extract sub-tabs into `src/components/workspace/` or feature subdirectories.
