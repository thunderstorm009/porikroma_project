import React, { useState } from 'react'
import {
  Bell, Bot, CalendarDays, ChevronDown, ChevronRight, Compass,
  Edit3, Globe2, LayoutDashboard, LogOut, Luggage, MapPin, Menu, MessageCircle,
  Plus, Search, Settings, ShieldCheck, Ticket, Users, Wallet, X
} from 'lucide-react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useNotifications } from '../../context/NotificationsContext'
import type { PlatformRole } from '../../types'
import { GlobalSearchModal } from './GlobalSearchModal'

export interface RouteFrameProps {
  children?: React.ReactNode
}

export function RouteFrame({ children }: RouteFrameProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user: currentUser, logout: authLogout, demoLogin } = useAuth()
  const { notifications: notificationsList, unreadCount, markAsRead, markAllAsRead } = useNotifications()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const logout = () => {
    authLogout()
    navigate('/login')
  }

  const switchAccount = async (role: PlatformRole) => {
    setUserMenuOpen(false)
    try {
      const switched = await demoLogin(role)
      navigate({ TRAVELER: '/dashboard', TOUR_PLANNER: '/planner/dashboard', ADMIN: '/admin/dashboard' }[switched.role])
    } catch {
      navigate('/login')
    }
  }

  const links = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Trips', path: '/trips', icon: Compass },
    { label: 'Tours', path: '/tours', icon: Luggage },
    { label: 'My bookings', path: '/my-bookings', icon: Ticket },
    { label: 'Group travel', path: '/group-travel/explore', icon: Users },
    { label: 'AI planner', path: '/ai-assistant', icon: Bot },
    { label: 'Destinations', path: '/destinations', icon: Globe2 },
    { label: 'Expenses', path: '/expenses', icon: Wallet },
    { label: 'Travel calendar', path: '/calendar', icon: CalendarDays },
    { label: 'Travel footprint', path: '/travel-footprint', icon: MapPin },
    { label: 'Community', path: '/community', icon: MessageCircle },
  ]

  return (
    <div className="route-shell">
      {mobileMenuOpen && (
        <div className="sidebar-backdrop" onClick={() => setMobileMenuOpen(false)} />
      )}
      <aside className={`sidebar route-sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="brand" onClick={() => { setMobileMenuOpen(false); navigate('/') }}>
          <span className="brand-mark">p</span>
          <span>porikroma</span>
        </div>

        {currentUser ? (
          <div className="workspace-switcher" onClick={() => setUserMenuOpen(!userMenuOpen)}>
            <div className="avatar">{currentUser?.name?.[0] || 'R'}</div>
            <div>
              <strong>{currentUser?.name || 'Rafi Ahmed'}</strong>
              <small>{currentUser?.role || 'TRAVELER'} workspace</small>
            </div>
            <ChevronDown size={15} />

            {userMenuOpen && (
              <div className="dropdown-menu user-dropdown-menu" onClick={(e) => e.stopPropagation()}>
                <div className="dropdown-header">
                  Signed in as <strong>{currentUser?.email}</strong>
                </div>
                <button className="dropdown-item" onClick={() => { setUserMenuOpen(false); setMobileMenuOpen(false); navigate('/profile') }}><Edit3 size={14} /> Profile</button>
                <button className="dropdown-item" onClick={() => { setUserMenuOpen(false); setMobileMenuOpen(false); navigate('/my-bookings') }}><Ticket size={14} /> My tour bookings</button>
                <button className="dropdown-item" onClick={() => { setUserMenuOpen(false); setMobileMenuOpen(false); navigate('/settings') }}><Settings size={14} /> Settings & Privacy</button>
                <div className="dropdown-label">Switch Role:</div>
                <button className="dropdown-item" onClick={() => switchAccount('TRAVELER')}>Traveler view</button>
                <button className="dropdown-item" onClick={() => switchAccount('TOUR_PLANNER')}>Tour planner view</button>
                <button className="dropdown-item" onClick={() => switchAccount('ADMIN')}>Admin view</button>
                <div className="dropdown-divider">
                  <button className="dropdown-item dropdown-item-danger" onClick={logout}><LogOut size={14} /> Sign out</button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="workspace-switcher" onClick={() => { setMobileMenuOpen(false); navigate('/login') }}>
            <div className="avatar avatar-guest">?</div>
            <div>
              <strong>Guest Explorer</strong>
              <small className="workspace-action-text">Sign in to book</small>
            </div>
          </div>
        )}

        <p className="nav-label">Workspace</p>
        <nav className="primary-nav">
          {links.map(({ label, path, icon: Icon }) => (
            <Link
              className={location.pathname.startsWith(path) ? 'nav-item active' : 'nav-item'}
              to={path}
              key={path}
              onClick={() => setMobileMenuOpen(false)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {label === 'AI planner' && <span className="new-dot" />}
            </Link>
          ))}
          {currentUser?.role === 'TOUR_PLANNER' && (
            <Link
              className={location.pathname.startsWith('/planner') ? 'nav-item active' : 'nav-item'}
              to="/planner/dashboard"
              onClick={() => setMobileMenuOpen(false)}
            >
              <ShieldCheck size={18} />
              <span>Planner ops</span>
            </Link>
          )}
          {currentUser?.role === 'ADMIN' && (
            <Link
              className={location.pathname.startsWith('/admin') ? 'nav-item active' : 'nav-item'}
              to="/admin/dashboard"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Settings size={18} />
              <span>Admin control</span>
            </Link>
          )}
        </nav>

        {currentUser ? (
          <div className="sidebar-bottom">
            <button className="nav-item" onClick={() => { setMobileMenuOpen(false); navigate('/notifications') }}>
              <Bell size={18} />
              <span>Notifications</span>
              {unreadCount > 0 && <span className="notification-count">{unreadCount}</span>}
            </button>
            <button className="nav-item" onClick={() => { setMobileMenuOpen(false); navigate('/settings') }}>
              <Settings size={18} />
              <span>Settings</span>
            </button>
            <div className="profile-row" onClick={() => { setMobileMenuOpen(false); navigate('/profile') }}>
              <div className="avatar">{currentUser?.name?.[0] || 'R'}</div>
              <div>
                <strong>{currentUser?.name || 'Rafi Ahmed'}</strong>
                <small>View profile</small>
              </div>
            </div>
          </div>
        ) : (
          <div className="sidebar-bottom sidebar-guest-actions">
            <button className="primary-btn small" onClick={() => { setMobileMenuOpen(false); navigate('/login') }}>
              Sign in
            </button>
            <button className="outline-btn small" onClick={() => { setMobileMenuOpen(false); navigate('/register') }}>
              Register
            </button>
          </div>
        )}
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          <div className="breadcrumbs">
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{location.pathname.split('/')[1] || 'Dashboard'}</strong>
          </div>

          <div className="top-actions">
            <div className="top-search" onClick={() => setSearchOpen(true)}>
              <Search size={16} />
              <input placeholder="Search anything (destinations, trips...)" readOnly />
              <kbd>⌘ K</kbd>
            </div>

            {currentUser ? (
              <>
                <div className="notification-wrapper">
                  <button className="icon-btn notification-btn" onClick={() => setNotificationsOpen(!notificationsOpen)} aria-label="Notifications">
                    <Bell size={19} />
                    {unreadCount > 0 && <i />}
                  </button>

                  {notificationsOpen && (
                    <div className="dropdown-menu notification-dropdown" onClick={(e) => e.stopPropagation()}>
                      <div className="notification-dropdown-header">
                        <strong>Notifications</strong>
                        <button className="notification-mark-all" onClick={() => markAllAsRead()}>Mark all read</button>
                      </div>
                      <div className="notification-dropdown-list">
                        {notificationsList.length ? (
                          notificationsList.slice(0, 5).map((n) => (
                            <div
                              key={n.id}
                              className={`notification-item ${n.read ? 'read' : 'unread'}`}
                              onClick={() => {
                                markAsRead(n.id)
                                setNotificationsOpen(false)
                                if (n.link) navigate(n.link)
                              }}
                            >
                              <strong>{n.type}</strong>
                              <p className="notification-item-detail">{n.detail}</p>
                            </div>
                          ))
                        ) : (
                          <div className="notification-empty">No notifications</div>
                        )}
                      </div>
                      <button
                        className="dropdown-item notification-footer-link"
                        onClick={() => { setNotificationsOpen(false); navigate('/notifications') }}
                      >
                        See all notifications
                      </button>
                    </div>
                  )}
                </div>

                <Link className="quick-add" to="/trips/create">
                  <Plus size={17} /> New trip
                </Link>
              </>
            ) : (
              <div className="top-guest-actions">
                <button className="outline-btn small" onClick={() => navigate('/login')}>Sign in</button>
                <button className="primary-btn small" onClick={() => navigate('/register')}>Start planning</button>
              </div>
            )}
          </div>
        </header>

        {children || <Outlet />}
      </main>

      {/* Global Quick Search Modal */}
      <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
