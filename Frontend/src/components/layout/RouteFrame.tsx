import React, { useEffect, useState } from 'react'
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
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Global keyboard shortcut for ⌘ K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

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
      {sidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`sidebar route-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand" onClick={() => { setSidebarOpen(false); navigate('/') }} style={{ cursor: 'pointer' }}>
          <span className="brand-mark">p</span>
          <span>porikroma</span>
        </div>

        {currentUser ? (
          <div className="workspace-switcher" onClick={() => setUserMenuOpen(!userMenuOpen)} style={{ cursor: 'pointer', position: 'relative' }}>
            <div className="avatar">{currentUser?.name?.[0] || 'R'}</div>
            <div>
              <strong>{currentUser?.name || 'Rafi Ahmed'}</strong>
              <small>{currentUser?.role || 'TRAVELER'} workspace</small>
            </div>
            <ChevronDown size={15} />

            {userMenuOpen && (
              <div className="dropdown-menu" onClick={(e) => e.stopPropagation()}>
                <div style={{ padding: '10px 16px', borderBottom: '1px solid #edf0ea', fontSize: '13px', color: '#4e5e52' }}>
                  Signed in as <strong style={{ color: '#1a2e22', display: 'block', fontSize: '13.5px', marginTop: '2px', wordBreak: 'break-all' }}>{currentUser?.email}</strong>
                </div>
                <button className="dropdown-item" onClick={() => { setUserMenuOpen(false); setSidebarOpen(false); navigate('/profile') }}><Edit3 size={16} /> Profile</button>
                <button className="dropdown-item" onClick={() => { setUserMenuOpen(false); setSidebarOpen(false); navigate('/my-bookings') }}><Ticket size={16} /> My tour bookings</button>
                <button className="dropdown-item" onClick={() => { setUserMenuOpen(false); setSidebarOpen(false); navigate('/settings') }}><Settings size={16} /> Settings & Privacy</button>
                <div style={{ padding: '10px 16px 4px', fontSize: '11.5px', textTransform: 'uppercase', color: '#5a685e', fontWeight: 600, letterSpacing: '0.5px' }}>Switch Role:</div>
                <button className="dropdown-item" onClick={() => switchAccount('TRAVELER')}>Traveler view</button>
                <button className="dropdown-item" onClick={() => switchAccount('TOUR_PLANNER')}>Tour planner view</button>
                <button className="dropdown-item" onClick={() => switchAccount('ADMIN')}>Admin view</button>
                <div style={{ borderTop: '1px solid #edf0ea', marginTop: '4px' }}>
                  <button className="dropdown-item" style={{ color: '#c02626' }} onClick={logout}><LogOut size={16} /> Sign out</button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="workspace-switcher" onClick={() => { setSidebarOpen(false); navigate('/login') }} style={{ cursor: 'pointer' }}>
            <div className="avatar" style={{ background: '#e1e8df', color: '#3f5847' }}>?</div>
            <div>
              <strong>Guest Explorer</strong>
              <small style={{ color: 'var(--green)' }}>Sign in to book</small>
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
              onClick={() => setSidebarOpen(false)}
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
              onClick={() => setSidebarOpen(false)}
            >
              <ShieldCheck size={18} />
              <span>Planner ops</span>
            </Link>
          )}
          {currentUser?.role === 'ADMIN' && (
            <Link
              className={location.pathname.startsWith('/admin') ? 'nav-item active' : 'nav-item'}
              to="/admin/dashboard"
              onClick={() => setSidebarOpen(false)}
            >
              <Settings size={18} />
              <span>Admin control</span>
            </Link>
          )}
        </nav>

        {currentUser ? (
          <div className="sidebar-bottom">
            <button className="nav-item" onClick={() => { setSidebarOpen(false); navigate('/notifications') }}>
              <Bell size={18} />
              <span>Notifications</span>
              {unreadCount > 0 && <span className="notification-count">{unreadCount}</span>}
            </button>
            <button className="nav-item" onClick={() => { setSidebarOpen(false); navigate('/settings') }}>
              <Settings size={18} />
              <span>Settings</span>
            </button>
            <div className="profile-row" onClick={() => { setSidebarOpen(false); navigate('/profile') }} style={{ cursor: 'pointer' }}>
              <div className="avatar">{currentUser?.name?.[0] || 'R'}</div>
              <div>
                <strong>{currentUser?.name || 'Rafi Ahmed'}</strong>
                <small>View profile</small>
              </div>
            </div>
          </div>
        ) : (
          <div className="sidebar-bottom" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px' }}>
            <button className="primary-btn small" onClick={() => { setSidebarOpen(false); navigate('/login') }} style={{ width: '100%', justifyContent: 'center' }}>
              Sign in
            </button>
            <button className="outline-btn small" onClick={() => { setSidebarOpen(false); navigate('/register') }} style={{ width: '100%', justifyContent: 'center' }}>
              Register
            </button>
          </div>
        )}
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle navigation menu"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div className="breadcrumbs">
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{location.pathname.split('/')[1] || 'Dashboard'}</strong>
          </div>

          <div className="top-actions">
            <div className="top-search" onClick={() => setSearchOpen(true)} style={{ cursor: 'pointer' }}>
              <Search size={16} />
              <input placeholder="Search anything (destinations, trips...)" readOnly />
              <kbd>⌘ K</kbd>
            </div>

            {currentUser ? (
              <>
                <div style={{ position: 'relative' }}>
                  <button className="icon-btn notification-btn" onClick={() => setNotificationsOpen(!notificationsOpen)} aria-label="Toggle notifications">
                    <Bell size={19} />
                    {unreadCount > 0 && <i />}
                  </button>

                  {notificationsOpen && (
                    <div className="dropdown-menu" style={{ width: '340px', maxWidth: 'calc(100vw - 24px)', right: 0 }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #edf0ea' }}>
                        <strong style={{ fontSize: '15px', color: '#1a2e22' }}>Notifications</strong>
                        <button className="text-btn" style={{ fontSize: '13px', color: 'var(--green)', padding: '2px 6px', fontWeight: 600 }} onClick={() => markAllAsRead()}>Mark all read</button>
                      </div>
                      <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                        {notificationsList.length ? (
                          notificationsList.slice(0, 5).map((n) => (
                            <div key={n.id} style={{ padding: '12px 16px', borderBottom: '1px solid #edf0ea', cursor: 'pointer', background: n.read ? '#fff' : '#f6faf4', transition: 'background 0.15s ease' }}
                              onClick={() => {
                                markAsRead(n.id)
                                setNotificationsOpen(false)
                                if (n.link) navigate(n.link)
                              }}>
                              <strong style={{ fontSize: '14px', color: '#1a2e22' }}>{n.type}</strong>
                              <p style={{ margin: '4px 0 0', color: '#4e5e52', fontSize: '13px', lineHeight: 1.45 }}>{n.detail}</p>
                            </div>
                          ))
                        ) : (
                          <div style={{ padding: '32px 16px', textAlign: 'center', color: '#5a685e', fontSize: '14px' }}>No notifications</div>
                        )}
                      </div>
                      <button className="dropdown-item" style={{ justifyContent: 'center', borderTop: '1px solid #edf0ea', fontWeight: 600, fontSize: '14px', color: '#245839', padding: '12px 16px' }}
                        onClick={() => { setNotificationsOpen(false); navigate('/notifications') }}>
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
              <div style={{ display: 'flex', gap: '8px' }}>
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
