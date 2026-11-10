import React, { useState } from 'react'
import {
  Bell, Bot, CalendarDays, ChevronDown, ChevronRight, Compass,
  Edit3, Globe2, LayoutDashboard, LogOut, MapPin, MessageCircle,
  Plus, Search, Settings, ShieldCheck, Users, Wallet
} from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
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
      <aside className="sidebar route-sidebar">
        <div className="brand">
          <span className="brand-mark">p</span>
          <span>porikroma</span>
        </div>

        <div className="workspace-switcher" onClick={() => setUserMenuOpen(!userMenuOpen)} style={{ cursor: 'pointer', position: 'relative' }}>
          <div className="avatar">{currentUser?.name?.[0] || 'R'}</div>
          <div>
            <strong>{currentUser?.name || 'Rafi Ahmed'}</strong>
            <small>{currentUser?.role || 'TRAVELER'} workspace</small>
          </div>
          <ChevronDown size={15} />

          {userMenuOpen && (
            <div className="dropdown-menu" onClick={(e) => e.stopPropagation()}>
              <div style={{ padding: '8px 14px', borderBottom: '1px solid #edf0ea', fontSize: '11px', color: '#77827a' }}>
                Signed in as <strong>{currentUser?.email}</strong>
              </div>
              <button className="dropdown-item" onClick={() => { setUserMenuOpen(false); navigate('/profile') }}><Edit3 size={14} /> Profile</button>
              <button className="dropdown-item" onClick={() => { setUserMenuOpen(false); navigate('/settings') }}><Settings size={14} /> Settings & Privacy</button>
              <div style={{ padding: '6px 14px 2px', fontSize: '10px', textTransform: 'uppercase', color: '#88948a', fontWeight: 600 }}>Switch Role:</div>
              <button className="dropdown-item" onClick={() => switchAccount('TRAVELER')}>Traveler view</button>
              <button className="dropdown-item" onClick={() => switchAccount('TOUR_PLANNER')}>Tour planner view</button>
              <button className="dropdown-item" onClick={() => switchAccount('ADMIN')}>Admin view</button>
              <div style={{ borderTop: '1px solid #edf0ea', marginTop: '4px' }}>
                <button className="dropdown-item" style={{ color: '#b33' }} onClick={logout}><LogOut size={14} /> Sign out</button>
              </div>
            </div>
          )}
        </div>

        <p className="nav-label">Workspace</p>
        <nav className="primary-nav">
          {links.map(({ label, path, icon: Icon }) => (
            <Link className={location.pathname.startsWith(path) ? 'nav-item active' : 'nav-item'} to={path} key={path}>
              <Icon size={18} />
              <span>{label}</span>
              {label === 'AI planner' && <span className="new-dot" />}
            </Link>
          ))}
          {currentUser?.role === 'TOUR_PLANNER' && (
            <Link className={location.pathname.startsWith('/planner') ? 'nav-item active' : 'nav-item'} to="/planner/dashboard">
              <ShieldCheck size={18} />
              <span>Planner ops</span>
            </Link>
          )}
          {currentUser?.role === 'ADMIN' && (
            <Link className={location.pathname.startsWith('/admin') ? 'nav-item active' : 'nav-item'} to="/admin/dashboard">
              <Settings size={18} />
              <span>Admin control</span>
            </Link>
          )}
        </nav>

        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => navigate('/notifications')}>
            <Bell size={18} />
            <span>Notifications</span>
            {unreadCount > 0 && <span className="notification-count">{unreadCount}</span>}
          </button>
          <button className="nav-item" onClick={() => navigate('/settings')}>
            <Settings size={18} />
            <span>Settings</span>
          </button>
          <div className="profile-row" onClick={() => navigate('/profile')} style={{ cursor: 'pointer' }}>
            <div className="avatar">{currentUser?.name?.[0] || 'R'}</div>
            <div>
              <strong>{currentUser?.name || 'Rafi Ahmed'}</strong>
              <small>View profile</small>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
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

            <div style={{ position: 'relative' }}>
              <button className="icon-btn notification-btn" onClick={() => setNotificationsOpen(!notificationsOpen)}>
                <Bell size={19} />
                {unreadCount > 0 && <i />}
              </button>

              {notificationsOpen && (
                <div className="dropdown-menu" style={{ width: '320px', right: 0 }} onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #edf0ea' }}>
                    <strong>Notifications</strong>
                    <button style={{ fontSize: '11px', color: 'var(--green)' }} onClick={() => markAllAsRead()}>Mark all read</button>
                  </div>
                  <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                    {notificationsList.length ? (
                      notificationsList.slice(0, 5).map((n) => (
                        <div key={n.id} style={{ padding: '10px 14px', borderBottom: '1px solid #edf0ea', fontSize: '11px', cursor: 'pointer', background: n.read ? '#fff' : '#f6faf4' }}
                          onClick={() => {
                            markAsRead(n.id)
                            setNotificationsOpen(false)
                            if (n.link) navigate(n.link)
                          }}>
                          <strong>{n.type}</strong>
                          <p style={{ margin: '3px 0 0', color: '#6d7770' }}>{n.detail}</p>
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: '20px', textAlign: 'center', color: '#889' }}>No notifications</div>
                    )}
                  </div>
                  <button className="dropdown-item" style={{ justifyContent: 'center', borderTop: '1px solid #edf0ea', fontWeight: 600 }}
                    onClick={() => { setNotificationsOpen(false); navigate('/notifications') }}>
                    See all notifications
                  </button>
                </div>
              )}
            </div>

            <Link className="quick-add" to="/trips/create">
              <Plus size={17} /> New trip
            </Link>
          </div>
        </header>

        {children}
      </main>

      {/* Global Quick Search Modal */}
      <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
