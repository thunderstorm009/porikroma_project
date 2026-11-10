import { lazy, Suspense } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'

import { ProtectedLayout } from './components/layout/ProtectedLayout'
import { RoleGuard } from './components/layout/RoleGuard'
import { RoleFrame } from './components/layout/RoleFrame'
import { RouteFrame } from './components/layout/RouteFrame'

// Standard pages (loaded directly for instant initial interaction)
import { PublicLanding } from './pages/public/PublicLanding'
import { AuthPage } from './pages/public/AuthPage'
import { DashboardPage } from './pages/traveler/DashboardPage'
import { TripsPage } from './pages/traveler/TripsPage'
import { CreateTrip } from './pages/traveler/CreateTrip'
import { TripWorkspace } from './pages/traveler/TripWorkspace'
import { DestinationsPage } from './pages/traveler/DestinationsPage'
import { DestinationDetails } from './pages/traveler/DestinationDetails'
import { ToursPage } from './pages/traveler/ToursPage'
import { TourDetailsPage } from './pages/traveler/TourDetailsPage'
import { MyBookingsPage } from './pages/traveler/MyBookingsPage'
import { GroupExplore } from './pages/traveler/GroupExplore'
import { GroupDetailsPage } from './pages/traveler/GroupDetailsPage'
import { MyGroupsPage } from './pages/traveler/MyGroupsPage'
import { GroupRequestsPage } from './pages/traveler/GroupRequestsPage'
import { ExpensesPage } from './pages/traveler/ExpensesPage'
import { CalendarPage } from './pages/traveler/CalendarPage'
import { CommunityPage } from './pages/traveler/CommunityPage'
import { NotificationsPage } from './pages/traveler/NotificationsPage'
import { ProfilePage } from './pages/traveler/ProfilePage'
import { SettingsPage } from './pages/traveler/SettingsPage'

// Heavy / specialized traveler pages (lazy loaded)
const PlannerPage = lazy(() => import('./pages/traveler/PlannerPage'))
const FootprintPage = lazy(() => import('./pages/traveler/FootprintPage'))

// Tour planner pages (lazy loaded)
const PlannerDashboard = lazy(() => import('./pages/planner/PlannerDashboard'))
const CreateTourPage = lazy(() => import('./pages/planner/CreateTourPage'))
const PlannerToursList = lazy(() => import('./pages/planner/PlannerToursList'))
const PlannerParticipants = lazy(() => import('./pages/planner/PlannerParticipants'))
const PlannerSchedules = lazy(() => import('./pages/planner/PlannerSchedules'))

// Admin control center pages (lazy loaded)
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'))
const AdminVerifications = lazy(() => import('./pages/admin/AdminVerifications'))
const AdminTrips = lazy(() => import('./pages/admin/AdminTrips'))
const AdminGroups = lazy(() => import('./pages/admin/AdminGroups'))
const AdminDestinations = lazy(() => import('./pages/admin/AdminDestinations'))
const AdminReports = lazy(() => import('./pages/admin/AdminReports'))

function PageFallback() {
  return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '240px' }}>
      <p className="muted">Loading view…</p>
    </div>
  )
}

export function AppRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<PublicLanding />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="/forgot-password" element={<AuthPage mode="forgot" />} />
        <Route path="/reset-password" element={<AuthPage mode="reset" />} />
        <Route path="/verify-email" element={<AuthPage mode="verify" />} />

        {/* Public / Traveler Tour Discovery (Accessible to both guests and logged-in travelers) */}
        <Route element={<RouteFrame><Outlet /></RouteFrame>}>
          <Route path="/tours" element={<ToursPage />} />
          <Route path="/tours/:id" element={<TourDetailsPage />} />
        </Route>

        {/* Protected Traveler Routes */}
        <Route element={<ProtectedLayout />}>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="app" element={<Navigate to="/dashboard" replace />} />
          <Route path="trips" element={<TripsPage />} />
          <Route path="trips/create" element={<CreateTrip />} />
          <Route path="trips/:tripId/*" element={<TripWorkspace />} />

          {/* Group Travel */}
          <Route path="group-travel" element={<Navigate to="/group-travel/explore" replace />} />
          <Route path="group-travel/explore" element={<GroupExplore />} />
          <Route path="group-travel/my-groups" element={<MyGroupsPage />} />
          <Route path="group-travel/requests" element={<GroupRequestsPage />} />
          <Route path="group-travel/invitations" element={<GroupRequestsPage />} />
          <Route path="group-travel/create" element={<CreateTrip />} />
          <Route path="group-travel/preview" element={<GroupDetailsPage />} />
          <Route path="group-travel/:groupId" element={<GroupDetailsPage />} />

          {/* Tour Bookings */}
          <Route path="my-bookings" element={<MyBookingsPage />} />

          {/* AI Planner */}
          <Route path="ai-assistant" element={<PlannerPage />} />

          {/* Destinations */}
          <Route path="explore" element={<DestinationsPage />} />
          <Route path="discover" element={<DestinationsPage />} />
          <Route path="destinations" element={<DestinationsPage />} />
          <Route path="destinations/:destinationId" element={<DestinationDetails />} />

          {/* Expenses & Calendar */}
          <Route path="expenses" element={<ExpensesPage />} />
          <Route path="calendar" element={<CalendarPage />} />

          {/* Footprint */}
          <Route path="travel-footprint" element={<FootprintPage subpage="overview" />} />
          <Route path="travel-footprint/passport" element={<FootprintPage subpage="passport" />} />
          <Route path="travel-footprint/achievements" element={<FootprintPage subpage="achievements" />} />
          <Route path="travel-footprint/timeline" element={<FootprintPage subpage="timeline" />} />

          {/* Community & Notifications */}
          <Route path="community" element={<CommunityPage />} />
          <Route path="notifications" element={<NotificationsPage />} />

          {/* Profile & Settings */}
          <Route path="profile" element={<ProfilePage />} />
          <Route path="profile/:userId" element={<ProfilePage />} />
          <Route path="users/:userId" element={<ProfilePage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Tour Planner Workspace */}
        <Route path="/planner/*" element={
          <RoleGuard role="TOUR_PLANNER">
            <RoleFrame role="planner">
              <Routes>
                <Route path="dashboard" element={<PlannerDashboard />} />
                <Route path="tours" element={<PlannerToursList />} />
                <Route path="tours/create" element={<CreateTourPage />} />
                <Route path="tours/participants" element={<PlannerParticipants />} />
                <Route path="bookings" element={<Navigate to="/planner/tours/participants" replace />} />
                <Route path="schedules" element={<PlannerSchedules />} />
                <Route path="*" element={<Navigate to="/planner/dashboard" replace />} />
              </Routes>
            </RoleFrame>
          </RoleGuard>
        } />

        {/* Admin Workspace */}
        <Route path="/admin/*" element={
          <RoleGuard role="ADMIN">
            <RoleFrame role="admin">
              <Routes>
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="planners" element={<AdminVerifications />} />
                <Route path="planners/verification" element={<AdminVerifications />} />
                <Route path="trips" element={<AdminTrips />} />
                <Route path="groups" element={<AdminGroups />} />
                <Route path="destinations" element={<AdminDestinations />} />
                <Route path="reports" element={<AdminReports />} />
                <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
              </Routes>
            </RoleFrame>
          </RoleGuard>
        } />

        {/* 404 Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default AppRoutes
