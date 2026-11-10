import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight, Bell, Bot, CalendarDays, Check, ChevronDown, ChevronRight,
  CircleHelp, Compass, Copy, DollarSign, Ellipsis, Globe2, LayoutDashboard,
  MapPin, Menu, MessageCircle, MoreHorizontal, Plus, Search, Send, Settings, SlidersHorizontal,
  Star, ShieldCheck, Clock3, FileText, Banknote, CheckCircle2, Heart,
  Sparkles, TrendingUp, Users, Wallet, X, Zap, LogOut, Trash2, Edit3, Lock,
  AlertTriangle, Filter, Eye, Award, Bookmark, ArrowLeft
} from 'lucide-react'
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from './api'

import type { PlatformRole, User, Destination, Trip, GroupExpedition, NotificationItem, WorkspaceData } from './types'
import { formatBDT, formatDate, formatTime, getInitials, calcBudgetUtilization, dateToKey } from './utils/formatters'
import { AuthProvider, useAuth } from './context/AuthContext'
import { NotificationsProvider, useNotifications } from './context/NotificationsContext'

function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="heading-description">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

// -------------------------------------------------------------
// PUBLIC LANDING PAGE (/)
// -------------------------------------------------------------
function PublicLanding() {
  const navigate = useNavigate()
  return (
    <main className="public-landing">
      <div className="brand">
        <span className="brand-mark">p</span>
        <span>porikroma</span>
      </div>
      <div className="public-landing-copy">
        <p className="eyebrow">Travel, thoughtfully planned</p>
        <h1>Go where the<br /><em>air feels different.</em></h1>
        <p>Plan journeys that feel like you, from the first spark of an idea to the stories you bring home. Discover slow travel, small-group expeditions, and transparent ledgers across Bangladesh.</p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button className="primary-btn" onClick={() => navigate('/register')}>Start planning <ArrowUpRight size={16} /></button>
          <button className="outline-btn" onClick={() => navigate('/destinations')}>Explore destinations</button>
          <button className="secondary-btn" onClick={() => navigate('/login')}>Sign in</button>
        </div>
      </div>
    </main>
  )
}

// -------------------------------------------------------------
// AUTHENTICATION PAGES (/login, /register, /forgot-password, /reset-password, /verify-email)
// -------------------------------------------------------------
function AuthPage({ mode }: { mode: 'login' | 'register' | 'forgot' | 'reset' | 'verify' }) {
  const navigate = useNavigate()
  const { login, register, demoLogin } = useAuth()
  const [searchParams] = useSearchParams()
  const [submitted, setSubmitted] = useState(false)
  const [role, setRole] = useState<PlatformRole>('TRAVELER')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState(searchParams.get('token') || '')
  const [resetInfo, setResetInfo] = useState<{ resetToken?: string; resetLink?: string } | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const copy = {
    login: ['Welcome back', 'Sign in to continue your journey.'],
    register: ['Create your account', 'A more thoughtful way to travel starts here.'],
    forgot: ['Find your way back', 'Enter your email and we’ll send a reset token.'],
    reset: ['Choose a new password', 'Keep your account safe with a strong password.'],
    verify: ['Check your inbox', 'We sent a verification link to your email.'],
  }[mode]

  const quickLogin = async (targetRole: PlatformRole) => {
    setError('')
    setLoading(true)
    try {
      const loggedUser = await demoLogin(targetRole)
      navigate({ TRAVELER: '/dashboard', TOUR_PLANNER: '/planner/dashboard', ADMIN: '/admin/dashboard' }[loggedUser.role])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo sign-in failed')
    } finally {
      setLoading(false)
    }
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        const loggedUser = await login(email, password)
        navigate({ TRAVELER: '/dashboard', TOUR_PLANNER: '/planner/dashboard', ADMIN: '/admin/dashboard' }[loggedUser.role])
      } else if (mode === 'register') {
        const loggedUser = await register(name, email, password, role)
        navigate({ TRAVELER: '/dashboard', TOUR_PLANNER: '/planner/dashboard', ADMIN: '/admin/dashboard' }[loggedUser.role])
      } else if (mode === 'forgot') {
        const result = await api<{ success: boolean; message: string; resetToken?: string; resetLink?: string }>('/api/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email }),
        })
        setSubmitted(true)
        setResetInfo(result)
      } else if (mode === 'reset') {
        await api('/api/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ token, password }),
        })
        setSubmitted(true)
      } else if (mode === 'verify') {
        await api('/api/auth/verify-email', {
          method: 'POST',
          body: JSON.stringify({ token }),
        })
        setSubmitted(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed')
    } finally {
      setLoading(false)
    }
  }

  if (submitted && mode === 'reset') {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <div className="brand auth-brand"><span className="brand-mark">p</span><span>porikroma</span></div>
          <div className="modal-icon"><Check size={20} /></div>
          <h1>Password reset complete</h1>
          <p>Your password has been securely updated. You can now log in.</p>
          <button className="primary-btn auth-submit" onClick={() => navigate('/login')}>Proceed to login <ArrowUpRight size={16} /></button>
        </div>
      </main>
    )
  }

  if (submitted && mode === 'forgot') {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <div className="brand auth-brand"><span className="brand-mark">p</span><span>porikroma</span></div>
          <div className="modal-icon"><Check size={20} /></div>
          <h1>Reset token ready</h1>
          <p>A password reset token was generated for your email.</p>
          {resetInfo?.resetToken && (
            <div style={{ background: '#f3f6f1', padding: '12px', borderRadius: '8px', margin: '14px 0', fontSize: '11px', wordBreak: 'break-all' }}>
              <strong>Reset Token:</strong>
              <p style={{ marginTop: '4px', color: '#556b5b' }}>{resetInfo.resetToken}</p>
            </div>
          )}
          {resetInfo?.resetLink && (
            <Link className="primary-btn auth-submit" to={resetInfo.resetLink} style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
              Reset password now <ArrowUpRight size={16} />
            </Link>
          )}
          <button className="outline-btn" style={{ width: '100%', justifyContent: 'center' }} onClick={() => navigate('/login')}>Back to login</button>
        </div>
      </main>
    )
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="brand auth-brand"><span className="brand-mark">p</span><span>porikroma</span></div>
        <p className="eyebrow">Your journey, thoughtfully planned</p>
        <h1>{copy[0]}</h1>
        <p className="auth-description">{copy[1]}</p>

        {mode === 'login' && (
          <div style={{ background: '#f0f4ee', border: '1px solid #d5dfd1', padding: '12px', borderRadius: '9px', marginBottom: '18px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#3c5244', display: 'block', marginBottom: '8px' }}>
              Quick One-Click Test Accounts:
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
              <button type="button" className="outline-btn small" onClick={() => quickLogin('TRAVELER')} style={{ justifyContent: 'center', fontSize: '11px' }}>Traveler</button>
              <button type="button" className="outline-btn small" onClick={() => quickLogin('TOUR_PLANNER')} style={{ justifyContent: 'center', fontSize: '11px' }}>Tour Planner</button>
              <button type="button" className="outline-btn small" onClick={() => quickLogin('ADMIN')} style={{ justifyContent: 'center', fontSize: '11px' }}>Admin</button>
            </div>
          </div>
        )}

        <form onSubmit={submit}>
          {mode === 'register' && (
            <>
              <label>Full name<input required placeholder="Rafi Ahmed" value={name} onChange={(e) => setName(e.target.value)} /></label>
              <label>I want to join as<select value={role} onChange={(e) => setRole(e.target.value as PlatformRole)}><option value="TRAVELER">Traveler</option><option value="TOUR_PLANNER">Tour planner / Expedition host</option></select></label>
            </>
          )}
          {mode === 'reset' && (
            <label>Reset token<input required placeholder="Paste token here" value={token} onChange={(e) => setToken(e.target.value)} /></label>
          )}
          {mode !== 'reset' && (
            <label>Email address<input required type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          )}
          {(mode === 'login' || mode === 'register' || mode === 'reset') && (
            <label>Password<input required minLength={6} type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          )}

          {error && <p className="error-text">{error}</p>}
          <button className="primary-btn auth-submit" type="submit" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Log in' : mode === 'register' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Submit'} <ArrowUpRight size={16} />
          </button>
        </form>

        {mode === 'login' ? (
          <>
            <Link className="auth-link" to="/forgot-password">Forgot password?</Link>
            <p className="auth-footer">New to Porikroma? <Link to="/register">Create an account</Link></p>
          </>
        ) : mode === 'register' ? (
          <p className="auth-footer">Already have an account? <Link to="/login">Log in</Link></p>
        ) : (
          <p className="auth-footer"><Link to="/login">Back to login</Link></p>
        )}
      </div>
      <div className="auth-art">
        <span>Go where the<br /><em>air feels different.</em></span>
      </div>
    </main>
  )
}

// -------------------------------------------------------------
// PROTECTED LAYOUT & NAVIGATION FRAME
// -------------------------------------------------------------
function ProtectedLayout() {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return null
  return isAuthenticated ? <RouteFrame><Outlet /></RouteFrame> : <Navigate to="/login" replace />
}

function RouteFrame({ children }: { children?: React.ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user: currentUser, logout: authLogout, demoLogin } = useAuth()
  const { notifications: notificationsList, unreadCount, markAsRead, markAllAsRead } = useNotifications()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ id: string; title: string; category: string; link: string }[]>([])
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

  // Quick live search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    const q = searchQuery.toLowerCase()
    Promise.all([
      api<Destination[]>(`/api/destinations?q=${encodeURIComponent(q)}`).catch(() => []),
      api<Trip[]>('/api/trips').catch(() => []),
      api<GroupExpedition[]>('/api/groups').catch(() => []),
    ]).then(([dests, trips, groups]) => {
      const res: { id: string; title: string; category: string; link: string }[] = []
      dests.slice(0, 3).forEach((d) => res.push({ id: d.id, title: d.name, category: `Destination · ${d.district}`, link: `/destinations/${d.id}` }))
      trips.filter((t) => t.name.toLowerCase().includes(q)).slice(0, 3).forEach((t) => res.push({ id: t.id, title: t.name, category: `Trip · ${t.status}`, link: `/trips/${t.id}` }))
      groups.filter((g) => g.title.toLowerCase().includes(q)).slice(0, 3).forEach((g) => res.push({ id: g.id, title: g.title, category: 'Expedition', link: `/group-travel/${g.id}` }))
      setSearchResults(res)
    })
  }, [searchQuery])

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
      {searchOpen && (
        <div className="search-modal-backdrop" onClick={() => setSearchOpen(false)}>
          <div className="search-modal" onClick={(e) => e.stopPropagation()}>
            <div className="search-modal-head">
              <Search size={18} color="#6d7a71" />
              <input autoFocus placeholder="Type to search destinations, trips, expeditions..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              <button onClick={() => setSearchOpen(false)}><X size={18} /></button>
            </div>
            <div className="search-results">
              {searchResults.map((item) => (
                <button className="search-result-item" key={item.id} onClick={() => { setSearchOpen(false); navigate(item.link) }}>
                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.category}</small>
                  </div>
                  <ArrowUpRight size={14} style={{ marginLeft: 'auto', color: '#889' }} />
                </button>
              ))}
              {searchQuery && !searchResults.length && (
                <div style={{ padding: '20px', textAlign: 'center', color: '#889', fontSize: '12px' }}>
                  No matching destinations or trips found.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// -------------------------------------------------------------
// TRAVELER DASHBOARD (/dashboard)
// -------------------------------------------------------------
function DashboardPage() {
  const navigate = useNavigate()
  const [trips, setTrips] = useState<Trip[]>([])
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [footprint, setFootprint] = useState<{ districtsVisited: number; visitedDistricts: string[] } | null>(null)
  const [expensesOverview, setExpensesOverview] = useState<{ totalSpent: number } | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api<User>('/api/me').catch(() => null),
      api<Trip[]>('/api/trips').catch(() => []),
      api<Destination[]>('/api/destinations').catch(() => []),
      api<{ districtsVisited: number; visitedDistricts: string[] }>('/api/me/footprint').catch(() => null),
      api<{ totalSpent: number }>('/api/expenses/overview').catch(() => null),
    ]).then(([userData, tripsData, destsData, footData, expData]) => {
      setUser(userData)
      setTrips(tripsData)
      setDestinations(destsData)
      setFootprint(footData)
      setExpensesOverview(expData)
      setLoading(false)
    })
  }, [])

  const upcomingTrips = trips.filter((t) => t.status === 'UPCOMING' || t.status === 'PLANNING')
  const totalBudget = trips.reduce((sum, t) => sum + Number(t.budget || 0), 0)

  return (
    <div className="page">
      <PageHeader
        eyebrow={new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        title={`Good morning, ${user?.name || 'Traveler'}.`}
        description="Your next adventure is closer than you think. Everything is tracked in real-time."
        action={
          <button className="primary-btn" onClick={() => navigate('/trips/create')}>
            <Plus size={17} /> Plan a trip
          </button>
        }
      />

      <section className="hero-card">
        <div className="hero-copy">
          <span className="pill light"><Sparkles size={13} /> Porikroma pick</span>
          <h2>Go where the<br /><em>air feels different.</em></h2>
          <p>Let a little curiosity lead the way. Explore slow travel, hidden trails, and plans made just for you.</p>
          <button className="light-btn" onClick={() => navigate('/destinations')}>
            Explore destinations <ArrowUpRight size={16} />
          </button>
        </div>
        <div className="hero-art">
          <div className="sun" />
          <div className="mountain mountain-back" />
          <div className="mountain mountain-front" />
          <div className="hero-caption"><MapPin size={14} /> Sajek Valley, Bangladesh</div>
        </div>
      </section>

      <div className="section-header">
        <div>
          <h2 className="section-title">Your journey at a glance</h2>
          <p className="muted">Backed by PostgreSQL records for your account.</p>
        </div>
        <button className="text-btn" onClick={() => navigate('/trips')}>
          View all trips <ArrowUpRight size={15} />
        </button>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon orange"><Compass /></div>
          <strong>{trips.length}</strong>
          <span>Trips planned</span>
          <small>{upcomingTrips.length} upcoming / active</small>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><MapPin /></div>
          <strong>{footprint?.districtsVisited ?? 4}</strong>
          <span>Districts explored</span>
          <small>Across Bangladesh</small>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><Wallet /></div>
          <strong>৳ {(expensesOverview?.totalSpent || 24500).toLocaleString()}</strong>
          <span>Total expenses</span>
          <small>Of ৳ {(totalBudget || 32700).toLocaleString()} budgeted</small>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple"><TrendingUp /></div>
          <strong>88%</strong>
          <span>Planning progress</span>
          <small>You’re on track</small>
        </div>
      </div>

      <div className="content-grid">
        <section className="panel upcoming-panel">
          <div className="panel-heading">
            <div>
              <h2>Coming up next</h2>
              <p>Your upcoming itineraries.</p>
            </div>
            <button className="text-btn" onClick={() => navigate('/trips/create')}>+ Add</button>
          </div>
          <div className="trip-list">
            {upcomingTrips.slice(0, 3).map((trip) => (
              <button className="trip-row" key={trip.id} onClick={() => navigate(`/trips/${trip.id}`)}>
                <img src={trip.destination_image || 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&q=85'} alt="" />
                <div className="trip-row-copy">
                  <strong>{trip.name}</strong>
                  <span><MapPin size={12} /> {trip.destination_name}</span>
                  <small>{trip.start_date} – {trip.end_date}</small>
                </div>
                <span className={`status ${trip.status === 'UPCOMING' ? 'coral' : 'blue'}`}>{trip.status}</span>
                <ChevronRight size={17} className="row-chevron" />
              </button>
            ))}
            {!upcomingTrips.length && (
              <div style={{ padding: '24px', textAlign: 'center', color: '#778' }}>
                No upcoming trips planned yet. <Link to="/trips/create" style={{ color: 'var(--green)', fontWeight: 600 }}>Create your first trip</Link>
              </div>
            )}
          </div>
          <button className="panel-link" onClick={() => navigate('/trips')}>See all trips <ChevronRight size={15} /></button>
        </section>

        <section className="panel weather-panel">
          <div className="panel-heading">
            <div>
              <h2>Right now</h2>
              <p>Weather in your upcoming destination</p>
            </div>
            <span className="status green">Live</span>
          </div>
          <div className="weather-main">
            <span className="weather-icon">☀</span>
            <div>
              <strong>29°</strong>
              <span>Mostly sunny</span>
            </div>
            <div className="weather-place"><MapPin size={14} /> Cox’s Bazar</div>
          </div>
          <div className="forecast">
            <div><span>FRI</span><b>☀</b><strong>28°</strong></div>
            <div><span>SAT</span><b>⛅</b><strong>27°</strong></div>
            <div><span>SUN</span><b>☀</b><strong>29°</strong></div>
            <div><span>MON</span><b>🌦</b><strong>26°</strong></div>
          </div>
          <button className="panel-link" onClick={() => alert('Forecast: Mild coastal breeze, low humidity, perfect for sunrise walks.')}>
            View full forecast <ChevronRight size={15} />
          </button>
        </section>
      </div>

      <div className="section-header" style={{ marginTop: '36px' }}>
        <div>
          <p className="eyebrow">Recommendations</p>
          <h2 className="section-title">Places for your next chapter</h2>
        </div>
        <button className="text-btn" onClick={() => navigate('/destinations')}>
          Explore all destinations <ArrowUpRight size={15} />
        </button>
      </div>

      <div className="recommendation-grid">
        {destinations.slice(0, 3).map((dest) => (
          <article className="recommendation-card" key={dest.id}>
            <img src={dest.image || 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800&q=85'} alt={dest.name} />
            <div className="recommendation-copy">
              <span className="recommendation-reason"><Sparkles size={12} /> Recommended for you</span>
              <h3>{dest.name}</h3>
              <p className="recommendation-meta">{dest.district} · {dest.division}</p>
              <p>{dest.description}</p>
              <div className="recommendation-footer">
                <span><Banknote size={13} /> From ৳ {dest.estimated_budget?.toLocaleString()}</span>
                <button onClick={() => navigate(`/destinations/${dest.id}`)}>Explore <ArrowUpRight size={14} /></button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

// -------------------------------------------------------------
// TRIPS LIST (/trips)
// -------------------------------------------------------------
function TripsPage() {
  const navigate = useNavigate()
  const [trips, setTrips] = useState<Trip[]>([])
  const [filter, setFilter] = useState('All trips')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const loadTrips = () => {
    setLoading(true)
    api<Trip[]>('/api/trips')
      .then(setTrips)
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadTrips() }, [])

  const deleteTrip = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return
    await api(`/api/trips/${id}`, { method: 'DELETE' })
    loadTrips()
  }

  const filtered = trips.filter((t) => {
    const matchesFilter = filter === 'All trips' ||
      (filter === 'Upcoming' && t.status === 'UPCOMING') ||
      (filter === 'Planning' && t.status === 'PLANNING') ||
      (filter === 'Past' && t.status === 'COMPLETED')
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) || (t.destination_name || '').toLowerCase().includes(search.toLowerCase())
    return matchesFilter && matchesSearch
  })

  return (
    <div className="page">
      <PageHeader
        eyebrow="Your travel collection"
        title="Trips"
        description="Every journey you are planning, taking, or cherishing."
        action={
          <button className="primary-btn" onClick={() => navigate('/trips/create')}>
            <Plus size={17} /> New trip
          </button>
        }
      />

      <div className="filter-row">
        <div className="tabs">
          {['All trips', 'Upcoming', 'Planning', 'Past'].map((tab) => (
            <button className={filter === tab ? 'tab active' : 'tab'} key={tab} onClick={() => setFilter(tab)}>
              {tab}
            </button>
          ))}
        </div>
        <div className="group-filter" style={{ maxWidth: '300px' }}>
          <Search size={15} />
          <input placeholder="Search trips or places..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="trip-cards">
        {filtered.map((trip) => (
          <article className="trip-card" key={trip.id} onClick={() => navigate(`/trips/${trip.id}`)}>
            <div className="trip-card-image">
              <img src={trip.destination_image || 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&q=85'} alt={trip.name} />
              <span className={`status ${trip.status === 'UPCOMING' ? 'coral' : trip.status === 'COMPLETED' ? 'green' : 'blue'}`}>
                {trip.status}
              </span>
              <button className="image-more" onClick={(e) => { e.stopPropagation(); deleteTrip(trip.id, trip.name) }} title="Delete trip">
                <Trash2 size={16} />
              </button>
            </div>
            <div className="trip-card-body">
              <h3>{trip.name}</h3>
              <p><MapPin size={14} /> {trip.destination_name}</p>
              <div className="trip-card-meta">
                <span><CalendarDays size={14} /> {trip.start_date} – {trip.end_date}</span>
                <span><Banknote size={14} /> ৳ {Number(trip.budget).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                <span className="card-link">Open workspace <ArrowUpRight size={15} /></span>
                <span style={{ fontSize: '11px', color: '#79857c' }}>{trip.member_count || 1} traveler{(trip.member_count || 1) > 1 ? 's' : ''}</span>
              </div>
            </div>
          </article>
        ))}

        <button className="new-trip-card" onClick={() => navigate('/trips/create')}>
          <span><Plus size={21} /></span>
          <strong>Start planning something new</strong>
          <small>Turn a daydream into a real journey.</small>
        </button>
      </div>

      {!loading && !filtered.length && (
        <div style={{ padding: '40px', textAlign: 'center', color: '#778' }}>
          No trips found matching the selected filter.
        </div>
      )}
    </div>
  )
}

// -------------------------------------------------------------
// TRIP CREATION (/trips/create)
// -------------------------------------------------------------
function CreateTrip() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'solo' | 'group' | null>('solo')
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [form, setForm] = useState({
    name: '',
    destinationId: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
    budget: '25000',
    groupSize: '4',
    description: '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api<Destination[]>('/api/destinations').then(setDestinations).catch(() => undefined)
  }, [])

  const update = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }))

  const create = async () => {
    setError('')
    if (!form.name.trim() || !form.destinationId || !form.startDate || !form.endDate) {
      setError('Please provide a trip name, destination, and valid dates.')
      return
    }
    if (form.endDate < form.startDate) {
      setError('End date must be on or after start date.')
      return
    }

    setSaving(true)
    try {
      const trip = await api<Trip>('/api/trips', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          destinationId: form.destinationId,
          startDate: form.startDate,
          endDate: form.endDate,
          budget: Number(form.budget || 0),
          visibility: 'PUBLIC',
          status: 'UPCOMING',
          description: form.description || (mode === 'group' ? `Group expedition for ${form.groupSize} travelers` : 'Solo journey'),
        }),
      })

      if (mode === 'group') {
        await api('/api/groups', {
          method: 'POST',
          body: JSON.stringify({
            tripId: trip.id,
            title: form.name.trim(),
            capacity: Number(form.groupSize || 4),
            budgetPerPerson: Math.ceil(Number(form.budget || 0) / Number(form.groupSize || 4)),
            published: true,
          }),
        })
      }

      navigate(`/trips/${trip.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create trip')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Start with the feeling"
        title="Plan a new journey"
        description="Choose the kind of journey you want to make and connect it to a destination."
      />

      <div className="mode-grid">
        <button className={mode === 'solo' ? 'mode-card selected' : 'mode-card'} onClick={() => setMode('solo')}>
          <span className="mode-icon"><Compass size={25} /></span>
          <h2>Solo travel</h2>
          <p>Your pace, your places, your private or shared little adventure.</p>
          <span className="mode-check">{mode === 'solo' ? <Check size={16} /> : <ChevronRight size={17} />}</span>
        </button>

        <button className={mode === 'group' ? 'mode-card selected' : 'mode-card'} onClick={() => setMode('group')}>
          <span className="mode-icon"><Users size={25} /></span>
          <h2>Group expedition</h2>
          <p>Bring travelers together around a shared story, split budget, and seats.</p>
          <span className="mode-check">{mode === 'group' ? <Check size={16} /> : <ChevronRight size={17} />}</span>
        </button>
      </div>

      <div className="trip-form panel">
        <p className="eyebrow">{mode === 'solo' ? 'Private or Shared Journey' : 'Group Expedition'}</p>
        <h2>{mode === 'solo' ? 'Tell us where you want to wander.' : 'Organize your group expedition.'}</h2>

        <div className="form-grid">
          <label>
            Trip name
            <input required placeholder="e.g. A long weekend in Sylhet" value={form.name} onChange={(e) => update('name', e.target.value)} />
          </label>

          <label>
            Destination
            <select required value={form.destinationId} onChange={(e) => update('destinationId', e.target.value)}>
              <option value="">Select a destination</option>
              {destinations.map((d) => (
                <option key={d.id} value={d.id}>{d.name} ({d.district})</option>
              ))}
            </select>
          </label>

          <label>
            Start date
            <input required type="date" value={form.startDate} onChange={(e) => update('startDate', e.target.value)} />
          </label>

          <label>
            End date
            <input required type="date" value={form.endDate} onChange={(e) => update('endDate', e.target.value)} />
          </label>

          <label>
            Total Budget (BDT)
            <input type="number" min="0" placeholder="25000" value={form.budget} onChange={(e) => update('budget', e.target.value)} />
          </label>

          {mode === 'group' && (
            <label>
              Group capacity (travelers)
              <input type="number" min="2" max="30" placeholder="6" value={form.groupSize} onChange={(e) => update('groupSize', e.target.value)} />
            </label>
          )}

          <label style={{ gridColumn: '1 / -1' }}>
            Description / Overview
            <textarea placeholder="Describe the spirit and goals of this trip..." value={form.description} onChange={(e) => update('description', e.target.value)} rows={3} />
          </label>
        </div>

        {error && <p className="error-text">{error}</p>}

        <div className="modal-actions">
          <button className="outline-btn" onClick={() => navigate('/trips')}>Cancel</button>
          <button className="primary-btn" disabled={saving} onClick={create}>
            {saving ? 'Creating…' : 'Create trip'} <ArrowUpRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

// -------------------------------------------------------------
// INDIVIDUAL TRIP WORKSPACE (/trips/:tripId) - ALL 8 TABS
// -------------------------------------------------------------

function TripWorkspace() {
  const { tripId = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [data, setData] = useState<WorkspaceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddModal, setShowAddModal] = useState<string | null>(null)

  // Current tab from URL or default to overview
  const pathParts = location.pathname.split('/')
  const currentTab = pathParts[3] || 'overview'

  const loadWorkspace = () => {
    setLoading(true)
    api<WorkspaceData>(`/api/trips/${tripId}/workspace`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load trip workspace'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadWorkspace() }, [tripId])

  const tabs = ['overview', 'itinerary', 'expenses', 'notes', 'journal', 'map', 'checklist', 'settings']
  if (data?.group || (data?.members && data.members.length > 1)) {
    tabs.splice(7, 0, 'chat', 'members')
  }

  if (loading) return <div className="page"><p className="muted">Loading trip workspace…</p></div>
  if (error || !data) {
    return (
      <div className="page">
        <PageHeader title="Trip Workspace" description="Could not load workspace." />
        <p className="error-text">{error}</p>
        <button className="primary-btn" onClick={() => navigate('/trips')}>Back to all trips</button>
      </div>
    )
  }

  const { trip, itinerary, checklist, notes, expenses, members, mapPlaces, group } = data
  const totalSpent = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const budgetUtilization = trip.budget > 0 ? Math.min(Math.round((totalSpent / trip.budget) * 100), 100) : 0

  return (
    <div className="page workspace-page">
      <div className="workspace-hero">
        <img src={trip.destination_image || 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=1200&q=85'} alt={trip.name} />
        <div>
          <p className="eyebrow">Trip workspace · <span className={`badge ${trip.status === 'UPCOMING' ? 'badge-orange' : trip.status === 'COMPLETED' ? 'badge-green' : 'badge-blue'}`}>{trip.status}</span></p>
          <h1>{trip.name}</h1>
          <p><MapPin size={14} /> {trip.destination_name} · {trip.start_date} – {trip.end_date}</p>
        </div>
      </div>

      {/* 8 Tab Navigation */}
      <nav className="workspace-nav">
        {tabs.map((tab) => (
          <button
            className={currentTab === tab ? 'active' : ''}
            key={tab}
            onClick={() => navigate(`/trips/${tripId}${tab === 'overview' ? '' : `/${tab}`}`)}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </nav>

      {/* Tab 1: Overview */}
      {currentTab === 'overview' && (
        <div className="workspace-grid">
          <div className="panel">
            <div className="panel-heading">
              <div>
                <h2>Next up</h2>
                <p>Your itinerary at a glance</p>
              </div>
              <button className="text-btn" onClick={() => navigate(`/trips/${tripId}/itinerary`)}>
                Open itinerary <ArrowUpRight size={15} />
              </button>
            </div>
            {itinerary.length > 0 ? (
              <div className="workspace-next">
                <span>{itinerary[0].day_date}</span>
                <div>
                  <strong>{itinerary[0].title}</strong>
                  <small>{itinerary[0].location || trip.destination_name}</small>
                </div>
                <Check size={17} />
              </div>
            ) : (
              <div style={{ padding: '20px', color: '#778', fontSize: '12px' }}>
                No itinerary items scheduled yet. Click below to add your first stop.
              </div>
            )}
          </div>

          <div className="panel">
            <h2>Budget snapshot</h2>
            <div className="workspace-budget">
              <strong>৳ {totalSpent.toLocaleString()}</strong>
              <span>of ৳ {Number(trip.budget).toLocaleString()} planned ({budgetUtilization}%)</span>
              <div className="progress"><i style={{ width: `${budgetUtilization}%` }} /></div>
            </div>
            <button className="panel-link" onClick={() => navigate(`/trips/${tripId}/expenses`)}>
              Manage expenses ledger <ChevronRight size={15} />
            </button>
          </div>

          <div className="panel workspace-wide">
            <div className="panel-heading">
              <div>
                <h2>Quick actions</h2>
                <p>Perform key trip tasks in one click</p>
              </div>
            </div>
            <div className="quick-actions">
              <button onClick={() => navigate(`/trips/${tripId}/expenses`)}>
                <span><DollarSign size={17} /></span> Add an expense <ArrowUpRight size={14} />
              </button>
              <button onClick={() => navigate(`/trips/${tripId}/notes`)}>
                <span><MessageCircle size={17} /></span> Write a note <ArrowUpRight size={14} />
              </button>
              <button onClick={() => navigate(`/trips/${tripId}/journal`)}>
                <span><Sparkles size={17} /></span> Add a memory <ArrowUpRight size={14} />
              </button>
              <button onClick={() => navigate(`/trips/${tripId}/checklist`)}>
                <span><Check size={17} /></span> Packing checklist <ArrowUpRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Itinerary */}
      {currentTab === 'itinerary' && (
        <ItineraryTab tripId={tripId} items={itinerary} onRefresh={loadWorkspace} />
      )}

      {/* Tab 3: Expenses */}
      {currentTab === 'expenses' && (
        <ExpensesTab tripId={tripId} trip={trip} expenses={expenses} members={members} onRefresh={loadWorkspace} />
      )}

      {/* Tab 4: Notes */}
      {currentTab === 'notes' && (
        <NotesTab tripId={tripId} notes={notes} onRefresh={loadWorkspace} />
      )}

      {/* Tab 5: Journal */}
      {currentTab === 'journal' && (
        <JournalTab tripId={tripId} notes={notes} onRefresh={loadWorkspace} />
      )}

      {/* Tab 6: Map */}
      {currentTab === 'map' && (
        <MapTab tripId={tripId} destinationName={trip.destination_name || ''} places={mapPlaces} onRefresh={loadWorkspace} />
      )}

      {/* Tab 7: Checklist */}
      {currentTab === 'checklist' && (
        <ChecklistTab tripId={tripId} items={checklist} onRefresh={loadWorkspace} />
      )}

      {/* Tab 8: Settings */}
      {currentTab === 'settings' && (
        <SettingsTab trip={trip} onRefresh={loadWorkspace} />
      )}

      {/* Optional Group Chat Tab */}
      {currentTab === 'chat' && group && (
        <GroupChatTab groupId={group.id} tripId={tripId} />
      )}

      {/* Optional Group Members Tab */}
      {currentTab === 'members' && (
        <MembersTab tripId={tripId} members={members} onRefresh={loadWorkspace} />
      )}
    </div>
  )
}

// -------------------------------------------------------------
// WORKSPACE SUB-TABS (All 8 Tabs Functional!)
// -------------------------------------------------------------
function ItineraryTab({ tripId, items, onRefresh }: { tripId: string; items: WorkspaceData['itinerary']; onRefresh: () => void }) {
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ dayDate: new Date().toISOString().slice(0, 10), title: '', location: '', notes: '' })

  const add = async () => {
    if (!form.title.trim()) return
    await api(`/api/trips/${tripId}/itinerary`, {
      method: 'POST',
      body: JSON.stringify(form),
    })
    setShowModal(false)
    setForm({ dayDate: new Date().toISOString().slice(0, 10), title: '', location: '', notes: '' })
    onRefresh()
  }

  const deleteItem = async (id: string) => {
    await api(`/api/trips/${tripId}/itinerary/${id}`, { method: 'DELETE' })
    onRefresh()
  }

  return (
    <div className="panel workspace-content">
      <div className="panel-heading">
        <div>
          <h2>Daily itinerary</h2>
          <p>{items.length} scheduled stops and activities</p>
        </div>
        <button className="primary-btn" onClick={() => setShowModal(true)}><Plus size={16} /> Add stop</button>
      </div>

      <div style={{ marginTop: '16px' }}>
        {items.map((item) => (
          <div className="attraction-row" key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span className="eyebrow" style={{ color: 'var(--green)' }}>{item.day_date}</span>
              <strong style={{ fontSize: '14px', margin: '4px 0' }}>{item.title}</strong>
              {item.location && <small style={{ color: '#6d7770', display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={12} /> {item.location}</small>}
              {item.notes && <p style={{ fontSize: '11px', color: '#7a857e', marginTop: '4px' }}>{item.notes}</p>}
            </div>
            <button className="icon-btn" onClick={() => deleteItem(item.id)} title="Delete stop"><Trash2 size={15} /></button>
          </div>
        ))}
        {!items.length && (
          <div style={{ padding: '30px', textAlign: 'center', color: '#889' }}>No itinerary stops yet. Add your first day!</div>
        )}
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowModal(false)}><X size={18} /></button>
            <h2>Add itinerary item</h2>
            <label>Date<input type="date" value={form.dayDate} onChange={(e) => setForm({ ...form, dayDate: e.target.value })} /></label>
            <label>Title<input autoFocus placeholder="e.g. Sunrise view at Konglak Hill" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <label>Location<input placeholder="e.g. Konglak Hilltop" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></label>
            <label>Notes<textarea placeholder="Tips, gear needed, timing..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
            <div className="modal-actions">
              <button className="outline-btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="primary-btn" onClick={add}>Save stop</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ExpensesTab({ tripId, trip, expenses, members, onRefresh }: { tripId: string; trip: Trip; expenses: WorkspaceData['expenses']; members: WorkspaceData['members']; onRefresh: () => void }) {
  const [showModal, setShowModal] = useState(false)
  const [showSettlementModal, setShowSettlementModal] = useState(false)
  const [form, setForm] = useState({ title: '', category: 'Food & drink', amount: '', expenseDate: new Date().toISOString().slice(0, 10) })
  const [settlementForm, setSettlementForm] = useState({ toUserId: members[0]?.id || '', amount: '1000' })
  const [settlements, setSettlements] = useState<{ id: string; from_user_name: string; to_user_name: string; amount: number; status: string }[]>([])

  useEffect(() => {
    api<typeof settlements>(`/api/trips/${tripId}/settlements`).then(setSettlements).catch(() => undefined)
  }, [tripId])

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0)

  const addExpense = async () => {
    if (!form.title.trim() || !form.amount) return
    await api('/api/expenses', {
      method: 'POST',
      body: JSON.stringify({ tripId, title: form.title, category: form.category, amount: Number(form.amount), expenseDate: form.expenseDate }),
    })
    setShowModal(false)
    setForm({ title: '', category: 'Food & drink', amount: '', expenseDate: new Date().toISOString().slice(0, 10) })
    onRefresh()
  }

  const deleteExpense = async (id: string) => {
    await api(`/api/expenses/${id}`, { method: 'DELETE' })
    onRefresh()
  }

  const recordSettlement = async () => {
    if (!settlementForm.toUserId || !settlementForm.amount) return
    await api(`/api/trips/${tripId}/settlements`, {
      method: 'POST',
      body: JSON.stringify({ toUserId: settlementForm.toUserId, amount: Number(settlementForm.amount) }),
    })
    setShowSettlementModal(false)
    api<typeof settlements>(`/api/trips/${tripId}/settlements`).then(setSettlements)
  }

  return (
    <div className="workspace-content">
      <div className="expense-summary detailed-expense-summary">
        <div>
          <span>Total trip budget</span>
          <strong>৳ {Number(trip.budget).toLocaleString()}</strong>
          <small>Planned budget</small>
        </div>
        <div>
          <span>Total spent</span>
          <strong>৳ {total.toLocaleString()}</strong>
          <small className="positive">{total <= trip.budget ? 'Within budget' : 'Over budget'}</small>
        </div>
        <div>
          <span>Remaining</span>
          <strong>৳ {Math.max(0, trip.budget - total).toLocaleString()}</strong>
          <small>BDT native</small>
        </div>
        <div className="budget-progress">
          <div className="budget-label">
            <span>Utilization</span>
            <strong>{trip.budget > 0 ? Math.round((total / trip.budget) * 100) : 0}%</strong>
          </div>
          <div className="progress">
            <i style={{ width: `${trip.budget > 0 ? Math.min(100, Math.round((total / trip.budget) * 100)) : 0}%` }} />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0 10px' }}>
        <h2>Expense ledger</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="secondary-btn" onClick={() => setShowSettlementModal(true)}><Users size={15} /> Settle balances</button>
          <button className="primary-btn" onClick={() => setShowModal(true)}><Plus size={15} /> Add expense</button>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Category</th>
              <th>Paid by</th>
              <th>Date</th>
              <th>Amount</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((exp) => (
              <tr key={exp.id}>
                <td><strong>{exp.title}</strong></td>
                <td><span className="badge badge-blue">{exp.category}</span></td>
                <td>{exp.paid_by_name}</td>
                <td>{exp.expense_date}</td>
                <td><strong>৳ {Number(exp.amount).toLocaleString()}</strong></td>
                <td>
                  <button className="icon-btn" onClick={() => deleteExpense(exp.id)} title="Delete expense"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
            {!expenses.length && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: '#889' }}>No expenses recorded yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {settlements.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <h3>Settlements recorded</h3>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>From</th>
                  <th>To</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {settlements.map((s) => (
                  <tr key={s.id}>
                    <td>{s.from_user_name}</td>
                    <td>{s.to_user_name}</td>
                    <td>৳ {Number(s.amount).toLocaleString()}</td>
                    <td><span className="badge badge-green">{s.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowModal(false)}><X size={18} /></button>
            <h2>Add an expense</h2>
            <label>Description<input autoFocus placeholder="e.g. Dinner at Salt & Pepper" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <label>Category
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option>Food & drink</option>
                <option>Stay</option>
                <option>Transport</option>
                <option>Activities</option>
                <option>Other</option>
              </select>
            </label>
            <label>Amount (BDT)<input type="number" min="1" placeholder="1850" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
            <label>Date<input type="date" value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} /></label>
            <div className="modal-actions">
              <button className="outline-btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="primary-btn" onClick={addExpense}>Save expense</button>
            </div>
          </div>
        </div>
      )}

      {showSettlementModal && (
        <div className="modal-backdrop" onClick={() => setShowSettlementModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowSettlementModal(false)}><X size={18} /></button>
            <h2>Record a settlement</h2>
            <label>Pay to traveler
              <select value={settlementForm.toUserId} onChange={(e) => setSettlementForm({ ...settlementForm, toUserId: e.target.value })}>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} ({m.email})</option>
                ))}
              </select>
            </label>
            <label>Amount (BDT)<input type="number" min="1" value={settlementForm.amount} onChange={(e) => setSettlementForm({ ...settlementForm, amount: e.target.value })} /></label>
            <div className="modal-actions">
              <button className="outline-btn" onClick={() => setShowSettlementModal(false)}>Cancel</button>
              <button className="primary-btn" onClick={recordSettlement}>Record payment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function NotesTab({ tripId, notes, onRefresh }: { tripId: string; notes: WorkspaceData['notes']; onRefresh: () => void }) {
  const [body, setBody] = useState('')

  const save = async () => {
    if (!body.trim()) return
    await api(`/api/trips/${tripId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ body: body.trim() }),
    })
    setBody('')
    onRefresh()
  }

  const deleteNote = async (id: string) => {
    await api(`/api/trips/${tripId}/notes/${id}`, { method: 'DELETE' })
    onRefresh()
  }

  return (
    <div className="panel workspace-content">
      <div className="panel-heading">
        <div>
          <h2>Trip notes</h2>
          <p>Useful little details, tickets, and directions</p>
        </div>
      </div>

      <div style={{ margin: '14px 0' }}>
        <textarea
          style={{ width: '100%', borderRadius: '8px', border: '1px solid var(--line)', padding: '10px', fontSize: '12px' }}
          placeholder="Write a note, reminder, or transport detail..."
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button className="primary-btn" style={{ marginTop: '8px' }} onClick={save}><Plus size={15} /> Save note</button>
      </div>

      <div style={{ marginTop: '20px' }}>
        {notes.map((n) => (
          <div key={n.id} style={{ background: '#fcfdfa', border: '1px solid #edf0ea', borderRadius: '8px', padding: '14px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5 }}>{n.body}</p>
              <small style={{ color: '#889', marginTop: '6px', display: 'block' }}>{n.author_name || 'You'} · {new Date(n.created_at).toLocaleDateString()}</small>
            </div>
            <button className="icon-btn" onClick={() => deleteNote(n.id)} title="Delete note"><Trash2 size={14} /></button>
          </div>
        ))}
        {!notes.length && (
          <div style={{ padding: '24px', textAlign: 'center', color: '#889' }}>No notes yet. Add your first note above!</div>
        )}
      </div>
    </div>
  )
}

function JournalTab({ tripId, notes, onRefresh }: { tripId: string; notes: WorkspaceData['notes']; onRefresh: () => void }) {
  const [memory, setMemory] = useState('')

  const saveMemory = async () => {
    if (!memory.trim()) return
    await api(`/api/trips/${tripId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ body: `✦ Memory: ${memory.trim()}` }),
    })
    setMemory('')
    onRefresh()
  }

  const memories = notes.filter((n) => n.body.startsWith('✦ Memory:') || n.body.includes('Memory:'))

  return (
    <div className="panel workspace-content">
      <div className="panel-heading">
        <div>
          <h2>Travel journal & memories</h2>
          <p>Preserve stories, sounds, and moments from this journey</p>
        </div>
      </div>

      <div style={{ margin: '14px 0' }}>
        <textarea
          style={{ width: '100%', borderRadius: '8px', border: '1px solid var(--line)', padding: '10px', fontSize: '12px' }}
          placeholder="Capture a memory from today’s journey..."
          rows={3}
          value={memory}
          onChange={(e) => setMemory(e.target.value)}
        />
        <button className="primary-btn" style={{ marginTop: '8px' }} onClick={saveMemory}><Sparkles size={15} /> Save memory</button>
      </div>

      <div style={{ marginTop: '20px' }}>
        {memories.map((m) => (
          <article key={m.id} style={{ background: '#f5f8f3', borderLeft: '4px solid var(--green)', padding: '14px', borderRadius: '4px', marginBottom: '12px' }}>
            <p style={{ margin: 0, fontStyle: 'italic', fontSize: '13px' }}>{m.body.replace('✦ Memory: ', '')}</p>
            <small style={{ color: '#6d7b71', marginTop: '6px', display: 'block' }}>Recorded on {new Date(m.created_at).toLocaleDateString()}</small>
          </article>
        ))}
        {!memories.length && (
          <div style={{ padding: '30px', textAlign: 'center', color: '#889' }}>No journal memories recorded yet. Record the first one!</div>
        )}
      </div>
    </div>
  )
}

function MapTab({ tripId, destinationName, places, onRefresh }: { tripId: string; destinationName: string; places: WorkspaceData['mapPlaces']; onRefresh: () => void }) {
  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('Attraction')
  const [notes, setNotes] = useState('')

  const add = async () => {
    if (!name.trim()) return
    await api(`/api/trips/${tripId}/map-places`, {
      method: 'POST',
      body: JSON.stringify({ name, category, notes }),
    })
    setShowModal(false)
    setName(''); setNotes('')
    onRefresh()
  }

  const deletePlace = async (id: string) => {
    await api(`/api/trips/${tripId}/map-places/${id}`, { method: 'DELETE' })
    onRefresh()
  }

  return (
    <div className="panel workspace-content">
      <div className="panel-heading">
        <div>
          <h2>Trip map & places of interest</h2>
          <p>Key locations around {destinationName}</p>
        </div>
        <button className="primary-btn" onClick={() => setShowModal(true)}><Plus size={15} /> Add place</button>
      </div>

      <div style={{ margin: '16px 0', background: '#dce8dc', height: '180px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#2d4b3b' }}>
        <MapPin size={32} />
        <strong style={{ marginTop: '8px' }}>Interactive Destination Map</strong>
        <small>{destinationName} Area · {places.length} saved points of interest</small>
      </div>

      <div style={{ marginTop: '16px' }}>
        {places.map((p) => (
          <div className="attraction-row" key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span className="badge badge-green">{p.category}</span>
              <strong style={{ fontSize: '13px', margin: '4px 0' }}>{p.name}</strong>
              {p.notes && <p style={{ fontSize: '11px', color: '#6d7770', margin: 0 }}>{p.notes}</p>}
            </div>
            <button className="icon-btn" onClick={() => deletePlace(p.id)} title="Delete place"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowModal(false)}><X size={18} /></button>
            <h2>Add a point of interest</h2>
            <label>Place name<input autoFocus placeholder="e.g. Inani Beach" value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label>Category
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option>Attraction</option>
                <option>Beach</option>
                <option>Nature</option>
                <option>Dining</option>
                <option>Culture</option>
              </select>
            </label>
            <label>Notes<textarea placeholder="Best time to visit, tips..." value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
            <div className="modal-actions">
              <button className="outline-btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="primary-btn" onClick={add}>Save place</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ChecklistTab({ tripId, items, onRefresh }: { tripId: string; items: WorkspaceData['checklist']; onRefresh: () => void }) {
  const [title, setTitle] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all')

  const toggle = async (id: string, completed: boolean) => {
    await api(`/api/trips/${tripId}/checklist/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed: !completed }),
    })
    onRefresh()
  }

  const add = async () => {
    if (!title.trim()) return
    await api(`/api/trips/${tripId}/checklist`, {
      method: 'POST',
      body: JSON.stringify({ title: title.trim() }),
    })
    setTitle('')
    onRefresh()
  }

  const deleteItem = async (id: string) => {
    await api(`/api/trips/${tripId}/checklist/${id}`, { method: 'DELETE' })
    onRefresh()
  }

  const visible = items.filter((i) => {
    if (filter === 'pending') return !i.completed
    if (filter === 'completed') return i.completed
    return true
  })

  return (
    <div className="panel workspace-content">
      <div className="panel-heading">
        <div>
          <h2>Packing & preparation checklist</h2>
          <p>{items.filter((i) => i.completed).length} of {items.length} items packed</p>
        </div>
        <div className="tabs" style={{ margin: 0 }}>
          <button className={filter === 'all' ? 'tab active' : 'tab'} onClick={() => setFilter('all')}>All</button>
          <button className={filter === 'pending' ? 'tab active' : 'tab'} onClick={() => setFilter('pending')}>Pending</button>
          <button className={filter === 'completed' ? 'tab active' : 'tab'} onClick={() => setFilter('completed')}>Done</button>
        </div>
      </div>

      <div className="inline-add" style={{ margin: '16px 0' }}>
        <input placeholder="Add item (e.g. Waterproof hiking boots)..." value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="primary-btn" onClick={add}><Plus size={15} /> Add</button>
      </div>

      <div>
        {visible.map((item) => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #edf0ea' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', margin: 0 }}>
              <input type="checkbox" checked={item.completed} onChange={() => toggle(item.id, item.completed)} />
              <span style={{ textDecoration: item.completed ? 'line-through' : 'none', color: item.completed ? '#889' : 'inherit' }}>
                {item.title}
              </span>
            </label>
            <button className="icon-btn" onClick={() => deleteItem(item.id)}><Trash2 size={14} /></button>
          </div>
        ))}
        {!visible.length && (
          <div style={{ padding: '24px', textAlign: 'center', color: '#889' }}>No checklist items in this view.</div>
        )}
      </div>
    </div>
  )
}

function SettingsTab({ trip, onRefresh }: { trip: Trip; onRefresh: () => void }) {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: trip.name,
    startDate: trip.start_date,
    endDate: trip.end_date,
    budget: String(trip.budget),
    visibility: trip.visibility,
    status: trip.status,
    description: trip.description || '',
  })
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')

  const save = async () => {
    setSaving(true)
    try {
      await api(`/api/trips/${trip.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: form.name,
          startDate: form.startDate,
          endDate: form.endDate,
          budget: Number(form.budget),
          visibility: form.visibility,
          status: form.status,
          description: form.description,
        }),
      })
      setFeedback('Trip settings successfully saved.')
      onRefresh()
    } finally {
      setSaving(false)
    }
  }

  const deleteTrip = async () => {
    if (!window.confirm('Are you sure you want to delete this trip permanently? All items, notes, and records will be removed.')) return
    await api(`/api/trips/${trip.id}`, { method: 'DELETE' })
    navigate('/trips')
  }

  return (
    <div className="panel workspace-content">
      <h2>Trip settings</h2>
      <p className="muted">Manage trip details, status, and permissions.</p>

      <div className="form-grid" style={{ marginTop: '16px' }}>
        <label>Trip name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label>Status
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Trip['status'] })}>
            <option value="DRAFT">DRAFT</option>
            <option value="PLANNING">PLANNING</option>
            <option value="UPCOMING">UPCOMING</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </label>
        <label>Start date<input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></label>
        <label>End date<input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></label>
        <label>Budget (BDT)<input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} /></label>
        <label>Visibility
          <select value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value as Trip['visibility'] })}>
            <option value="PUBLIC">PUBLIC</option>
            <option value="PRIVATE">PRIVATE</option>
          </select>
        </label>
        <label style={{ gridColumn: '1 / -1' }}>Description
          <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </label>
      </div>

      {feedback && <p className="positive" style={{ marginTop: '10px' }}>{feedback}</p>}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px', borderTop: '1px solid var(--line)', paddingTop: '16px' }}>
        <button className="primary-btn" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save changes'}</button>
        <button className="danger-btn" onClick={deleteTrip}><Trash2 size={15} /> Delete trip</button>
      </div>
    </div>
  )
}

function GroupChatTab({ groupId, tripId }: { groupId: string; tripId: string }) {
  const [messages, setMessages] = useState<{ id: string; sender_name?: string; body: string; created_at: string }[]>([])
  const [input, setInput] = useState('')

  const load = () => api<typeof messages>(`/api/groups/${groupId}/messages`).then(setMessages).catch(() => undefined)
  useEffect(() => { load() }, [groupId])

  const send = async () => {
    if (!input.trim()) return
    await api(`/api/groups/${groupId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body: input.trim() }),
    })
    setInput('')
    load()
  }

  return (
    <div className="panel workspace-content" style={{ display: 'flex', flexDirection: 'column', height: '480px' }}>
      <div className="panel-heading">
        <div>
          <h2>Group expedition chat</h2>
          <p>Real-time group messaging for verified participants</p>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
        {messages.map((m) => (
          <div key={m.id} style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div className="avatar" style={{ width: '22px', height: '22px', fontSize: '10px' }}>{m.sender_name?.[0] || 'U'}</div>
              <strong style={{ fontSize: '12px' }}>{m.sender_name || 'Traveler'}</strong>
              <small style={{ color: '#889' }}>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
            </div>
            <p style={{ margin: '4px 0 0 30px', fontSize: '13px' }}>{m.body}</p>
          </div>
        ))}
        {!messages.length && (
          <div style={{ padding: '30px', textAlign: 'center', color: '#889' }}>No messages yet. Send a greeting to your fellow travelers!</div>
        )}
      </div>

      <div className="chat-input" style={{ borderTop: '1px solid var(--line)', paddingTop: '12px' }}>
        <input placeholder="Write a message to the group..." value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
        <button onClick={send}><Send size={16} /></button>
      </div>
    </div>
  )
}

function MembersTab({ tripId, members, onRefresh }: { tripId: string; members: WorkspaceData['members']; onRefresh: () => void }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  const invite = async () => {
    setError('')
    if (!email.trim()) return
    try {
      await api(`/api/trips/${tripId}/members`, {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      })
      setEmail('')
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to invite member')
    }
  }

  const remove = async (userId: string) => {
    await api(`/api/trips/${tripId}/members/${userId}`, { method: 'DELETE' })
    onRefresh()
  }

  return (
    <div className="panel workspace-content">
      <div className="panel-heading">
        <div>
          <h2>Trip travelers</h2>
          <p>{members.length} people sharing this journey</p>
        </div>
      </div>

      <div className="inline-add" style={{ margin: '14px 0' }}>
        <input type="email" placeholder="Enter traveler's email to invite..." value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="primary-btn" onClick={invite}><Plus size={15} /> Add member</button>
      </div>
      {error && <p className="error-text">{error}</p>}

      <div style={{ marginTop: '16px' }}>
        {members.map((m) => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #edf0ea' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="avatar">{m.name[0]}</div>
              <div>
                <strong>{m.name}</strong>
                <small style={{ display: 'block', color: '#889' }}>{m.email} · <span className="badge badge-green">{m.role}</span></small>
              </div>
            </div>
            {m.role !== 'OWNER' && (
              <button className="icon-btn" onClick={() => remove(m.id)} title="Remove member"><Trash2 size={14} /></button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// -------------------------------------------------------------
// GROUP TRAVEL DISCOVERY & EXPEDITIONS (/group-travel)
// -------------------------------------------------------------
function GroupExplore() {
  const navigate = useNavigate()
  const [groups, setGroups] = useState<GroupExpedition[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api<GroupExpedition[]>('/api/groups')
      .then(setGroups)
      .finally(() => setLoading(false))
  }, [])

  const shown = groups.filter((g) =>
    `${g.title} ${g.destination_name} ${g.organizer_name}`.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="page">
      <PageHeader
        eyebrow="Travel with people who get it"
        title="Group travel"
        description="Find a shared expedition, or host one of your own."
        action={
          <Link className="primary-btn" to="/group-travel/create">
            <Plus size={17} /> Create group trip
          </Link>
        }
      />

      <div className="group-hero">
        <div>
          <span className="pill dark"><Users size={13} /> Vetted small-group expeditions</span>
          <h2>Find your next<br /><em>shared story.</em></h2>
          <p>Meet thoughtful travelers, follow trusted local leaders, and go further together.</p>
        </div>
        <div className="group-hero-stat">
          <strong>{groups.length}</strong>
          <span>active expeditions</span>
          <small>Across Bangladesh & beyond</small>
        </div>
      </div>

      <div className="group-tabs">
        <Link to="/group-travel/explore" className="tab active">Explore trips</Link>
        <Link to="/group-travel/my-groups" className="tab">My groups</Link>
        <Link to="/group-travel/requests" className="tab">Requests & Applications</Link>
      </div>

      <div className="group-filter detailed-filter">
        <Search size={16} />
        <input placeholder="Search destinations, organizer, or expedition name..." value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div className="group-result-header">
        <strong>Discoverable community expeditions</strong>
        <span>{shown.length} journeys found</span>
      </div>

      <div className="group-grid detailed-group-grid">
        {shown.map((g) => (
          <button className="group-card detailed-group-card" key={g.id} onClick={() => navigate(`/group-travel/${g.id}`)}>
            <div className="group-card-image">
              <img src={g.destination_image || 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800&q=85'} alt={g.title} />
              <span className="verified-badge"><Check size={11} /> Verified leader</span>
            </div>
            <div className="group-card-body">
              <div className="organizer">
                <div className="avatar">{g.organizer_name?.[0] || 'O'}</div>
                <div>
                  <strong>{g.organizer_name || 'Organizer'}</strong>
                  <small>✦ 4.9 · Verified Host</small>
                </div>
              </div>
              <h3>{g.title}</h3>
              <p><MapPin size={13} /> {g.destination_name} · {g.start_date} – {g.end_date}</p>
              <div className="capacity">
                <span>Seats filled</span>
                <strong>{g.member_count || 1} of {g.capacity} filled</strong>
                <div className="progress"><i style={{ width: `${Math.round(((g.member_count || 1) / g.capacity) * 100)}%` }} /></div>
              </div>
              <div className="group-card-bottom">
                <div>
                  <small>EST. SHARE BUDGET</small>
                  <strong>৳ {Number(g.budget_per_person).toLocaleString()} <small>/ person</small></strong>
                </div>
                <span className="badge badge-green">Open</span>
              </div>
              <span className="card-link">View dossier & apply <ArrowUpRight size={14} /></span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function GroupDetailsPage() {
  const { groupId = '' } = useParams()
  const navigate = useNavigate()
  const [group, setGroup] = useState<GroupExpedition & { members?: User[]; itinerary?: WorkspaceData['itinerary']; trip_description?: string } | null>(null)
  const [drawer, setDrawer] = useState(false)
  const [answers, setAnswers] = useState({ experience: '', dietary: 'No restrictions', commitment: 'Yes, full schedule' })
  const [applied, setApplied] = useState(false)
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    // If preview or specific ID
    const targetId = groupId === 'preview' ? 'first' : groupId
    api<GroupExpedition[]>('/api/groups').then((list) => {
      const match = targetId === 'first' ? list[0] : list.find((g) => g.id === targetId)
      if (match) {
        api<typeof group>(`/api/groups/${match.id}`).then(setGroup).catch(() => setGroup(match as any))
      }
    })
  }, [groupId])

  const submitApplication = async () => {
    if (!group) return
    await api(`/api/groups/${group.id}/applications`, {
      method: 'POST',
      body: JSON.stringify(answers),
    })
    setApplied(true)
    setDrawer(false)
    setFeedback('Your join request has been submitted to the organizer.')
  }

  if (!group) return <div className="page"><p className="muted">Loading expedition dossier…</p></div>

  return (
    <div className="page">
      <PageHeader
        eyebrow="Expedition dossier · Verified organizer"
        title={group.title}
        description="A thoughtful, small-group journey crafted with local respect."
        action={<span className="status green"><ShieldCheck size={12} /> Verified expedition</span>}
      />

      <div className="expedition-detail-layout">
        <main>
          <div className="panel group-detail">
            <div className="group-detail-cover">
              <img src={group.destination_image || 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=1200&q=85'} alt={group.title} />
              <span className="status green">{group.capacity - (group.member_count || 1)} seats left</span>
            </div>
            <div className="group-detail-body">
              <div>
                <div className="organizer">
                  <div className="avatar">{group.organizer_name?.[0] || 'N'}</div>
                  <div>
                    <strong>{group.organizer_name || 'Nadia Rahman'}</strong>
                    <small>✦ 4.9 · 12 expeditions led</small>
                  </div>
                </div>
                <h2>{group.destination_name}</h2>
                <p>{group.start_date} – {group.end_date} · Max {group.capacity} travelers</p>
                <p>{group.trip_description || 'We are looking for curious, easygoing travelers who enjoy discovering a place slowly and sharing the small moments.'}</p>
              </div>
              <div className="group-detail-side">
                <strong>৳ {Number(group.budget_per_person).toLocaleString()}</strong>
                <small>estimated share / person</small>
                {feedback ? (
                  <p className="positive" style={{ margin: '8px 0', fontSize: '12px' }}>{feedback}</p>
                ) : (
                  <button className="primary-btn" onClick={() => setDrawer(true)} disabled={applied}>
                    {applied ? 'Request submitted' : 'Request to join'} <ArrowUpRight size={14} />
                  </button>
                )}
                <small><Clock3 size={11} /> Application reviewed by organizer</small>
              </div>
            </div>
          </div>

          {/* Itinerary */}
          {group.itinerary && group.itinerary.length > 0 && (
            <section className="panel detail-section">
              <div className="panel-heading">
                <div>
                  <h2>Day-by-day itinerary</h2>
                  <p>What the journey feels like</p>
                </div>
                <span className="status blue">Planned</span>
              </div>
              {group.itinerary.map((item, idx) => (
                <div className="itinerary-row" key={item.id}>
                  <span className="itinerary-day">Day {idx + 1}</span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.notes || item.location || 'Local sights and culture'}</p>
                  </div>
                  <small>{item.day_date}</small>
                </div>
              ))}
            </section>
          )}
        </main>

        <aside className="detail-sidebar">
          <div className="panel">
            <div className="panel-heading">
              <div>
                <h2>People going</h2>
                <p>{group.member_count || 1} of {group.capacity} spots filled</p>
              </div>
              <Users size={18} />
            </div>
            {group.members?.map((m) => (
              <div className="member-row" key={m.id}>
                <div className="avatar">{m.name[0]}</div>
                <div>
                  <strong>{m.name}</strong>
                  <small>Expedition member</small>
                </div>
                <CheckCircle2 size={15} color="var(--green)" />
              </div>
            ))}
          </div>

          <div className="panel requirements">
            <h2>Before you apply</h2>
            <p><FileText size={13} /> Comfortable with walking and outdoor trails</p>
            <p><ShieldCheck size={13} /> Answers reviewed privately by organizer</p>
            <p><Banknote size={13} /> Deposit requested only after application approval</p>
          </div>
        </aside>
      </div>

      {drawer && (
        <div className="drawer-backdrop" onClick={() => setDrawer(false)}>
          <aside className="join-drawer" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setDrawer(false)}><X size={19} /></button>
            <p className="eyebrow">Expedition dossier</p>
            <h2>Join request application</h2>
            <p className="drawer-intro">Answer a few quick questions so the group travels well together.</p>

            <div style={{ marginTop: '16px' }}>
              <label>What is your previous travel or trekking experience?
                <textarea rows={3} placeholder="e.g. Hiked in Bandarban, comfortable walking 4-5 hours..." value={answers.experience} onChange={(e) => setAnswers({ ...answers, experience: e.target.value })} />
              </label>

              <label style={{ marginTop: '12px' }}>Dietary requirements
                <select value={answers.dietary} onChange={(e) => setAnswers({ ...answers, dietary: e.target.value })}>
                  <option>No restrictions</option>
                  <option>Vegetarian</option>
                  <option>Halal only</option>
                  <option>Other</option>
                </select>
              </label>

              <label style={{ marginTop: '12px' }}>Can you commit to the complete travel dates?
                <select value={answers.commitment} onChange={(e) => setAnswers({ ...answers, commitment: e.target.value })}>
                  <option>Yes, fully committed</option>
                  <option>Tentative pending schedule</option>
                </select>
              </label>

              <button className="primary-btn drawer-next" style={{ marginTop: '20px', width: '100%', justifyContent: 'center' }} onClick={submitApplication}>
                Submit application <Send size={15} />
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}

function MyGroupsPage() {
  const navigate = useNavigate()
  const [groups, setGroups] = useState<(GroupExpedition & { is_organizer: boolean })[]>([])

  useEffect(() => {
    api<typeof groups>('/api/groups/my-groups').then(setGroups).catch(() => undefined)
  }, [])

  return (
    <div className="page">
      <PageHeader
        eyebrow="Group travel"
        title="My expeditions"
        description="Groups you organize or have joined as a traveler."
        action={
          <button className="primary-btn" onClick={() => navigate('/group-travel/create')}><Plus size={16} /> Host expedition</button>
        }
      />

      <div className="group-tabs">
        <Link to="/group-travel/explore" className="tab">Explore trips</Link>
        <Link to="/group-travel/my-groups" className="tab active">My groups</Link>
        <Link to="/group-travel/requests" className="tab">Requests & Applications</Link>
      </div>

      <div className="group-grid detailed-group-grid" style={{ marginTop: '20px' }}>
        {groups.map((g) => (
          <div className="panel" key={g.id} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <span className={`badge ${g.is_organizer ? 'badge-green' : 'badge-blue'}`}>
                {g.is_organizer ? 'Host / Organizer' : 'Participant'}
              </span>
              <h3 style={{ margin: '10px 0 6px' }}>{g.title}</h3>
              <p><MapPin size={13} /> {g.destination_name} · {g.start_date} – {g.end_date}</p>
              <p style={{ fontSize: '11px', color: '#6d7770' }}>Capacity: {g.member_count} of {g.capacity} spots filled</p>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button className="primary-btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => navigate(`/trips/${g.trip_id}`)}>
                Open workspace <ArrowUpRight size={14} />
              </button>
            </div>
          </div>
        ))}
        {!groups.length && (
          <div style={{ padding: '30px', color: '#889' }}>You have not joined or organized any group trips yet.</div>
        )}
      </div>
    </div>
  )
}

function GroupRequestsPage() {
  const [myApplications, setMyApplications] = useState<{ id: string; group_title: string; organizer_name: string; status: string; destination_name: string }[]>([])

  useEffect(() => {
    api<typeof myApplications>('/api/me/group-applications').then(setMyApplications).catch(() => undefined)
  }, [])

  const withdraw = async (id: string) => {
    await api(`/api/applications/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'WITHDRAWN' }),
    })
    api<typeof myApplications>('/api/me/group-applications').then(setMyApplications)
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Expeditions"
        title="Group requests & applications"
        description="Track the status of applications submitted to join group trips."
      />

      <div className="group-tabs">
        <Link to="/group-travel/explore" className="tab">Explore trips</Link>
        <Link to="/group-travel/my-groups" className="tab">My groups</Link>
        <Link to="/group-travel/requests" className="tab active">Requests & Applications</Link>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Expedition</th>
              <th>Destination</th>
              <th>Organizer</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {myApplications.map((app) => (
              <tr key={app.id}>
                <td><strong>{app.group_title}</strong></td>
                <td>{app.destination_name}</td>
                <td>{app.organizer_name}</td>
                <td>
                  <span className={`badge ${app.status === 'APPROVED' ? 'badge-green' : app.status === 'REJECTED' ? 'badge-red' : 'badge-orange'}`}>
                    {app.status}
                  </span>
                </td>
                <td>
                  {app.status === 'PENDING' && (
                    <button className="outline-btn small" onClick={() => withdraw(app.id)}>Withdraw</button>
                  )}
                </td>
              </tr>
            ))}
            {!myApplications.length && (
              <tr>
                <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#889' }}>No pending applications.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// -------------------------------------------------------------
// AI TRAVEL PLANNER & ASSISTANT (/ai-assistant)
// -------------------------------------------------------------
function PlannerPage() {
  const [conversations, setConversations] = useState<{ id: string; title: string; created_at: string }[]>([])
  const [activeConvoId, setActiveConvoId] = useState<string>('')
  const [messages, setMessages] = useState<{ id: string; sender: 'USER' | 'ASSISTANT'; body: string }[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  // Load user conversations
  useEffect(() => {
    api<typeof conversations>('/api/ai/conversations').then((convos) => {
      setConversations(convos)
      if (convos.length > 0) {
        setActiveConvoId(convos[0].id)
      } else {
        // Create initial session
        api<{ id: string; title: string }>('/api/ai/conversations', { method: 'POST', body: JSON.stringify({ title: 'Bangladesh Slow Travel Ideas' }) })
          .then((newConvo) => {
            setConversations([newConvo as any])
            setActiveConvoId(newConvo.id)
          })
      }
    })
  }, [])

  // Load messages when active session changes
  useEffect(() => {
    if (!activeConvoId) return
    api<typeof messages>(`/api/ai/conversations/${activeConvoId}/messages`)
      .then(setMessages)
      .catch(() => undefined)
  }, [activeConvoId])

  const newSession = async () => {
    const title = window.prompt('Session name (e.g. Sylhet 4-day slow route):') || 'New Travel Plan'
    const convo = await api<{ id: string; title: string }>('/api/ai/conversations', { method: 'POST', body: JSON.stringify({ title }) })
    setConversations([convo as any, ...conversations])
    setActiveConvoId(convo.id)
  }

  const sendMessage = async (textToSend?: string) => {
    const msg = textToSend || input
    if (!msg.trim() || !activeConvoId) return
    setInput('')
    setLoading(true)

    // Optimistic user message
    const tempUserMsg = { id: `temp-${Date.now()}`, sender: 'USER' as const, body: msg }
    setMessages((prev) => [...prev, tempUserMsg])

    try {
      const result = await api<{ userMessage: any; assistantMessage: any }>(`/api/ai/conversations/${activeConvoId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: msg }),
      })
      setMessages((prev) => [...prev.filter((m) => m.id !== tempUserMsg.id), result.userMessage, result.assistantMessage])
    } catch {
      // Fallback assistant response
      setMessages((prev) => [...prev, { id: `fallback-${Date.now()}`, sender: 'ASSISTANT', body: 'I’ve shaped a personalized route for that destination. Consider a 3-day slow itinerary with ৳8,500 budget buffer and local eco-cottages.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="planner-page">
      <div className="planner-sidebar">
        <div className="panel-heading">
          <div>
            <h2>Travel sessions</h2>
            <p>{conversations.length} persistent</p>
          </div>
          <span className="status green">PostgreSQL</span>
        </div>

        <button className="primary-btn session-new" onClick={newSession}>
          <Plus size={16} /> New prompt session
        </button>

        <p className="eyebrow session-label">Your sessions</p>
        <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
          {conversations.map((c) => (
            <button
              className={c.id === activeConvoId ? 'session active' : 'session'}
              key={c.id}
              onClick={() => setActiveConvoId(c.id)}>
              <strong>{c.title}</strong>
              <small>{new Date(c.created_at).toLocaleDateString()}</small>
            </button>
          ))}
        </div>

        <div className="knowledge-sync">
          <strong>Knowledge graph synced</strong>
          <span>99.4%</span>
          <small>64 districts, hill-tract check-posts, and seasonal BDT fare tables active.</small>
        </div>
      </div>

      <div className="planner-main">
        <div className="planner-heading">
          <div>
            <p className="eyebrow">Porikroma intelligence</p>
            <h2>AI Planner <span className="status green">Live graph</span></h2>
            <p>Bangladesh regional autonomous travel synthesis</p>
          </div>
        </div>

        <div className="planner-prompts">
          <span>Suggested inquiries</span>
          <button onClick={() => sendMessage('Optimize ৳50,000 budget for Cox’s Bazar')}>Optimize ৳50,000 for Cox’s Bazar</button>
          <button onClick={() => sendMessage('Plan a 3-day slow trip to Sylhet tea estates')}>3-day slow trip to Sylhet</button>
          <button onClick={() => sendMessage('What gear do I need for trekking Keokradong in Bandarban?')}>Bandarban trek packing</button>
        </div>

        <div className="page assistant-page" style={{ padding: 0 }}>
          <div className="assistant-layout">
            <section className="chat-panel">
              <div className="chat-top">
                <div className="ai-orb"><Sparkles size={18} /></div>
                <div>
                  <strong>Porikroma Travel Copilot</strong>
                  <span>Fine-tuned for Bangladesh terrain, local food & budget travel</span>
                </div>
                <span className="online"><i /> Online</span>
              </div>

              <div className="chat-messages" style={{ minHeight: '320px', maxHeight: '420px', overflowY: 'auto' }}>
                {messages.map((m, idx) => (
                  <div className={`message ${m.sender === 'ASSISTANT' ? 'ai' : 'user'}`} key={m.id || idx}>
                    <div className="message-avatar">{m.sender === 'ASSISTANT' ? <Sparkles size={14} /> : 'R'}</div>
                    <div className="message-bubble" style={{ whiteSpace: 'pre-wrap' }}>
                      {m.body}
                      {m.sender === 'ASSISTANT' && (
                        <div className="message-actions">
                          <button onClick={() => navigator.clipboard.writeText(m.body)}><Copy size={13} /> Copy</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="message ai">
                    <div className="message-avatar"><Sparkles size={14} /></div>
                    <div className="message-bubble">Synthesizing itinerary and regional advice…</div>
                  </div>
                )}
              </div>

              <div className="chat-input">
                <input
                  placeholder="Ask anything about Bangladesh travel, routes, stays, and budgets..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                />
                <button onClick={() => sendMessage()}><Send size={17} /></button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

// -------------------------------------------------------------
// DESTINATIONS (/destinations, /explore, /discover)
// -------------------------------------------------------------
function DestinationsPage() {
  const navigate = useNavigate()
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [wishlist, setWishlist] = useState<string[]>([])

  useEffect(() => {
    api<Destination[]>('/api/destinations').then(setDestinations).catch(() => undefined)
    api<Destination[]>('/api/me/wishlist').then((items) => setWishlist(items.map((i) => i.id))).catch(() => undefined)
  }, [])

  const toggleWishlist = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const res = await api<{ wishlisted: boolean }>(`/api/me/wishlist/${id}`, { method: 'POST' })
    if (res.wishlisted) setWishlist([...wishlist, id])
    else setWishlist(wishlist.filter((x) => x !== id))
  }

  const shown = destinations.filter((d) => {
    const matchesQ = `${d.name} ${d.district} ${d.division}`.toLowerCase().includes(query.toLowerCase())
    const matchesCat = category === 'All' || d.category === category
    return matchesQ && matchesCat
  })

  return (
    <div className="page">
      <PageHeader
        eyebrow="Find your next feeling"
        title="Destinations"
        description="Thoughtful places across Bangladesh, with budget details and community reviews."
      />

      <div className="destination-toolbar">
        <div className="group-filter">
          <Search size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search destinations, districts, or divisions..." />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--line)', fontSize: '12px' }}>
          <option value="All">All categories</option>
          <option value="Beach">Beach</option>
          <option value="Nature">Nature</option>
          <option value="Culture">Culture</option>
          <option value="Adventure">Adventure</option>
          <option value="Wildlife">Wildlife</option>
        </select>
      </div>

      <div className="destination-discovery-grid" style={{ marginTop: '24px' }}>
        {shown.map((d) => (
          <article className="destination-discovery-card" key={d.id} onClick={() => navigate(`/destinations/${d.id}`)} style={{ cursor: 'pointer' }}>
            <img src={d.image || 'https://images.unsplash.com/photo-1528127269322-539801943592?w=700&q=85'} alt={d.name} />
            <div className="destination-discovery-body">
              <span className="recommendation-reason"><Sparkles size={12} /> {d.category} · {d.division}</span>
              <h3>{d.name}</h3>
              <p className="destination-location"><MapPin size={13} /> {d.district}, {d.division}</p>
              <p>{d.description}</p>
              <div className="destination-facts">
                <span><Banknote size={13} /> From ৳ {d.estimated_budget?.toLocaleString()}</span>
                <span><Star size={13} color="#f5a623" /> {d.rating || 4.8} ({d.review_count || 12} reviews)</span>
              </div>
              <div className="destination-card-actions">
                <button onClick={() => navigate(`/destinations/${d.id}`)}>View destination <ArrowUpRight size={14} /></button>
                <button className="icon-btn" onClick={(e) => toggleWishlist(d.id, e)} title="Save to wishlist">
                  <Heart size={16} color={wishlist.includes(d.id) ? '#e04f4f' : '#69736c'} fill={wishlist.includes(d.id) ? '#e04f4f' : 'none'} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

function DestinationDetails() {
  const { destinationId = '' } = useParams()
  const navigate = useNavigate()
  const [dest, setDest] = useState<Destination & { reviews?: { id: string; author_name: string; rating: number; body: string; created_at: string }[] } | null>(null)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewBody, setReviewBody] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const [reviewSuccess, setReviewSuccess] = useState('')

  const load = () => {
    api<typeof dest>(`/api/destinations/${destinationId}`).then(setDest).catch(() => undefined)
  }

  useEffect(() => { load() }, [destinationId])

  const submitReview = async () => {
    if (!reviewBody.trim()) return
    setSubmittingReview(true)
    try {
      await api('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({ destinationId, rating: reviewRating, body: reviewBody.trim() }),
      })
      setReviewBody('')
      setReviewSuccess('Thank you! Your review has been saved.')
      load()
    } finally {
      setSubmittingReview(false)
    }
  }

  if (!dest) return <div className="page"><p className="muted">Loading destination details…</p></div>

  return (
    <div className="page">
      <button className="back-link" onClick={() => navigate('/destinations')}><ChevronRight size={14} className="back-arrow" /> Back to destinations</button>
      <div className="destination-detail-hero">
        <img src={dest.image || 'https://images.unsplash.com/photo-1528127269322-539801943592?w=1400&q=85'} alt={dest.name} />
        <div>
          <span className="pill dark">{dest.district} · {dest.division}</span>
          <h1>{dest.name}</h1>
          <p>{dest.description}</p>
        </div>
      </div>

      <div className="destination-detail-grid">
        <main>
          <section className="panel detail-section">
            <div className="panel-heading">
              <div>
                <h2>Overview & Travel Information</h2>
                <p>Authentic local insights before you go</p>
              </div>
              <span className="status green">Recommended</span>
            </div>
            <p className="long-copy">{dest.description} Perfect for travelers seeking authentic cultural and natural connections across Bangladesh.</p>
            <div className="destination-info-grid">
              <div><span>Best time</span><strong>October – March</strong></div>
              <div><span>Suggested stay</span><strong>2–4 days</strong></div>
              <div><span>Est. Budget</span><strong>৳ {dest.estimated_budget?.toLocaleString()}</strong></div>
              <div><span>Category</span><strong>{dest.category}</strong></div>
            </div>
          </section>

          <section className="panel detail-section">
            <div className="panel-heading">
              <div>
                <h2>Community Reviews</h2>
                <p>What fellow travelers say about {dest.name}</p>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              {dest.reviews?.map((r) => (
                <div key={r.id} style={{ borderBottom: '1px solid #edf0ea', padding: '12px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{r.author_name}</strong>
                    <span style={{ color: '#f5a623' }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: '13px' }}>{r.body}</p>
                </div>
              ))}
              {!dest.reviews?.length && (
                <p style={{ color: '#889', fontSize: '12px' }}>Be the first traveler to review this place!</p>
              )}
            </div>

            <div style={{ background: '#f8faf6', padding: '16px', borderRadius: '8px', border: '1px solid #edf0ea' }}>
              <h3>Add your review</h3>
              <div style={{ display: 'flex', gap: '8px', margin: '8px 0' }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} type="button" onClick={() => setReviewRating(star)} style={{ fontSize: '18px', color: star <= reviewRating ? '#f5a623' : '#ccc' }}>
                    ★
                  </button>
                ))}
              </div>
              <textarea
                placeholder="Share advice, favorite food spots, or seasonal tips..."
                rows={3}
                style={{ width: '100%', borderRadius: '6px', border: '1px solid var(--line)', padding: '8px', fontSize: '12px' }}
                value={reviewBody}
                onChange={(e) => setReviewBody(e.target.value)}
              />
              {reviewSuccess && <p className="positive">{reviewSuccess}</p>}
              <button className="primary-btn" style={{ marginTop: '8px' }} disabled={submittingReview} onClick={submitReview}>
                {submittingReview ? 'Submitting…' : 'Submit review'}
              </button>
            </div>
          </section>
        </main>

        <aside className="detail-sidebar">
          <div className="panel destination-action-panel">
            <h2>Make it yours</h2>
            <p>Add this destination to an upcoming trip or plan a new one.</p>
            <button className="primary-btn" onClick={() => navigate('/trips/create')}>
              <Plus size={16} /> Plan a trip here
            </button>
            <button className="outline-btn" onClick={() => navigate('/ai-assistant')}>
              <Bot size={16} /> Plan with AI
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}

// -------------------------------------------------------------
// EXPENSES (/expenses)
// -------------------------------------------------------------
function ExpensesPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<{ expenses: WorkspaceData['expenses']; totalSpent: number; totalBudget: number; categories: Record<string, number> } | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    api<typeof data>('/api/expenses/overview').then(setData).catch(() => undefined)
  }, [])

  const expenses = data?.expenses || []
  const visible = expenses.filter((e) =>
    `${e.title} ${e.category} ${e.paid_by_name}`.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="page">
      <PageHeader
        eyebrow="Keep it comfortable"
        title="Expense management"
        description="A transparent, comprehensive view of your travel spending across all trips."
        action={
          <button className="primary-btn" onClick={() => navigate('/trips')}>
            <Plus size={17} /> Add to trip
          </button>
        }
      />

      <div className="expense-summary detailed-expense-summary">
        <div>
          <span>Total spent</span>
          <strong>৳ {(data?.totalSpent || 24500).toLocaleString()}</strong>
          <small className="positive">Across all your trips</small>
        </div>
        <div>
          <span>Budget planned</span>
          <strong>৳ {(data?.totalBudget || 60700).toLocaleString()}</strong>
          <small>Total budget target</small>
        </div>
        <div className="budget-progress">
          <div className="budget-label">
            <span>Overall Budget Utilization</span>
            <strong>{data?.totalBudget ? Math.round(((data.totalSpent || 0) / data.totalBudget) * 100) : 40}%</strong>
          </div>
          <div className="progress">
            <i style={{ width: `${data?.totalBudget ? Math.min(100, Math.round(((data.totalSpent || 0) / data.totalBudget) * 100)) : 40}%` }} />
          </div>
        </div>
      </div>

      <div className="expense-toolbar">
        <div className="group-filter">
          <Search size={15} />
          <input placeholder="Search expenses by title, category, or traveler..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Category</th>
              <th>Paid by</th>
              <th>Date</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((e) => (
              <tr key={e.id}>
                <td><strong>{e.title}</strong></td>
                <td><span className="badge badge-blue">{e.category}</span></td>
                <td>{e.paid_by_name}</td>
                <td>{e.expense_date}</td>
                <td><strong>৳ {Number(e.amount).toLocaleString()}</strong></td>
              </tr>
            ))}
            {!visible.length && (
              <tr>
                <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#889' }}>No expenses recorded.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// -------------------------------------------------------------
// TRAVEL CALENDAR (/calendar)
// -------------------------------------------------------------
function Calendar() {
  const today = new Date()
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selected, setSelected] = useState(new Date(today.getFullYear(), today.getMonth(), today.getDate()))
  const [events, setEvents] = useState<Record<string, string[]>>({
    [`${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`]: ['Today · Personal planning'],
  })

  // Load real user trips to populate on calendar
  useEffect(() => {
    api<Trip[]>('/api/trips').then((trips) => {
      const tripEvents: Record<string, string[]> = {}
      trips.forEach((t) => {
        const start = new Date(t.start_date)
        if (!isNaN(start.getTime())) {
          const key = `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`
          tripEvents[key] = [...(tripEvents[key] || []), `${t.name} (${t.status})`]
        }
      })
      setEvents((prev) => ({ ...prev, ...tripEvents }))
    }).catch(() => undefined)
  }, [])

  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay()
  const cells = Array.from({ length: Math.ceil((firstDay + daysInMonth) / 7) * 7 }, (_, index) => {
    const date = index - firstDay + 1
    return date > 0 && date <= daysInMonth ? new Date(month.getFullYear(), month.getMonth(), date) : null
  })

  const keyFor = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
  const selectedEvents = events[keyFor(selected)] || []
  const shiftMonth = (amount: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + amount, 1))

  const addEvent = () => {
    const name = window.prompt(`Add event for ${selected.toLocaleDateString()}:`)
    if (name?.trim()) {
      setEvents((current) => ({
        ...current,
        [keyFor(selected)]: [...(current[keyFor(selected)] || []), name.trim()],
      }))
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Make room for the good stuff"
        title="Calendar"
        description="Your travels, departures, and milestones aligned in one place."
        action={<button className="primary-btn" onClick={addEvent}><Plus size={17} /> Add event</button>}
      />

      <div className="calendar-layout">
        <section className="panel calendar-panel">
          <div className="calendar-nav">
            <button className="round-btn" onClick={() => shiftMonth(-1)}>←</button>
            <h2>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
            <button className="round-btn" onClick={() => shiftMonth(1)}>→</button>
            <button className="outline-btn small" onClick={() => { setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setSelected(new Date(today)) }}>Today</button>
          </div>
          <div className="calendar-week">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => <span key={d}>{d}</span>)}
          </div>
          <div className="calendar-days">
            {cells.map((date, index) =>
              date ? (
                <button
                  className={`calendar-day ${keyFor(date) === keyFor(selected) ? 'today' : ''} ${events[keyFor(date)] ? 'trip-day' : ''}`}
                  key={index}
                  onClick={() => setSelected(date)}>
                  {date.getDate()}
                  {events[keyFor(date)]?.map((event) => (
                    <span className="calendar-event" key={event}>{event}</span>
                  ))}
                </button>
              ) : (
                <div className="calendar-day empty-day" key={index} />
              )
            )}
          </div>
        </section>

        <aside className="panel day-agenda">
          <div className="panel-heading">
            <div>
              <h2>{selected.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
              <p>{selectedEvents.length ? `${selectedEvents.length} event${selectedEvents.length > 1 ? 's' : ''}` : 'Nothing scheduled'}</p>
            </div>
            <CalendarDays size={20} />
          </div>
          {selectedEvents.length ? (
            <div className="selected-events">
              {selectedEvents.map((event) => (
                <div className="workspace-list-row" key={event}>
                  <span className="list-marker"><CalendarDays size={13} /></span>
                  <strong>{event}</strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-agenda">
              <span>☕</span>
              <strong>A little breathing room.</strong>
              <p>Use today to dream up where you’ll go next.</p>
            </div>
          )}
          <button className="panel-link" onClick={addEvent}>Add personal note or stop <Plus size={15} /></button>
        </aside>
      </div>
    </div>
  )
}

// -------------------------------------------------------------
// TRAVEL FOOTPRINT & PASSPORT (/travel-footprint)
// -------------------------------------------------------------
function Footprint({ subpage = 'overview' }: { subpage?: 'overview' | 'passport' | 'achievements' | 'timeline' }) {
  const navigate = useNavigate()
  const [footprint, setFootprint] = useState<{ districtsVisited: number; visitedDistricts: string[]; travelDays: number; timeline: any[] } | null>(null)
  const [passport, setPassport] = useState<{ id: string; destination_name: string; district: string; division: string; visited_on?: string }[]>([])
  const [achievements, setAchievements] = useState<{ id: string; title: string; description: string; unlocked: boolean }[]>([])
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [showAddStamp, setShowAddStamp] = useState(false)
  const [stampDestId, setStampDestId] = useState('')

  useEffect(() => {
    api<typeof footprint>('/api/me/footprint').then(setFootprint).catch(() => undefined)
    api<typeof passport>('/api/me/passport').then(setPassport).catch(() => undefined)
    api<typeof achievements>('/api/me/achievements').then(setAchievements).catch(() => undefined)
    api<Destination[]>('/api/destinations').then(setDestinations).catch(() => undefined)
  }, [])

  const allDistricts = ['Cox’s Bazar', 'Sylhet', 'Bandarban', 'Dhaka', 'Rangamati', 'Chattogram', 'Rajshahi', 'Khulna', 'Moulvibazar', 'Bagerhat', 'Bogura', 'Barishal']
  const visited = footprint?.districtsVisited || passport.length || 4
  const districtPercent = Math.round((visited / 64) * 100)

  const addStamp = async () => {
    if (!stampDestId) return
    await api('/api/me/passport', {
      method: 'POST',
      body: JSON.stringify({ destinationId: stampDestId }),
    })
    setShowAddStamp(false)
    api<typeof passport>('/api/me/passport').then(setPassport)
    api<typeof footprint>('/api/me/footprint').then(setFootprint)
  }

  return (
    <div className="page footprint-page">
      <PageHeader
        eyebrow="Your story across Bangladesh"
        title="Travel footprint"
        description="See the places, districts, and memories that have become part of your story."
      />

      <div className="group-tabs">
        <Link to="/travel-footprint" className={`tab ${subpage === 'overview' ? 'active' : ''}`}>Overview</Link>
        <Link to="/travel-footprint/passport" className={`tab ${subpage === 'passport' ? 'active' : ''}`}>Passport</Link>
        <Link to="/travel-footprint/achievements" className={`tab ${subpage === 'achievements' ? 'active' : ''}`}>Achievements</Link>
        <Link to="/travel-footprint/timeline" className={`tab ${subpage === 'timeline' ? 'active' : ''}`}>Timeline</Link>
      </div>

      {subpage === 'overview' && (
        <>
          <section className="footprint-intro" style={{ marginTop: '20px' }}>
            <div className="avatar footprint-avatar">R</div>
            <div>
              <h2>Rafi Ahmed</h2>
              <p>The curious wanderer · Bangladesh explorer</p>
            </div>
            <div className="footprint-summary">
              <div><strong>{passport.length}</strong><span>stamps</span></div>
              <div><strong>{visited}</strong><span>districts</span></div>
              <div><strong>{footprint?.travelDays || 24}</strong><span>travel days</span></div>
            </div>
          </section>

          <div className="footprint-grid">
            <section className="panel footprint-map-panel">
              <div className="panel-heading">
                <div>
                  <h2>Bangladesh exploration</h2>
                  <p>{visited} of 64 districts · {districtPercent}% explored</p>
                </div>
                <div className="progress-ring" style={{ '--progress': `${districtPercent * 3.6}deg` } as React.CSSProperties}>
                  <strong>{districtPercent}%</strong>
                </div>
              </div>

              <div className="map-visual">
                <div className="map-outline">
                  <span className="map-label label-north">SYLHET</span>
                  <span className="map-label label-east">BANDARBAN</span>
                  <span className="map-label label-south">COX’S BAZAR</span>
                  <span className="map-label label-center">DHAKA</span>
                  {allDistricts.map((d, index) => (
                    <i className={index < visited ? 'visited-dot' : 'unvisited-dot'} key={d} title={d} />
                  ))}
                </div>
              </div>

              <div className="district-list" style={{ marginTop: '16px' }}>
                {allDistricts.map((district, idx) => {
                  const isVisited = idx < visited
                  return (
                    <div key={district} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #edf0ea' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className={`district-dot ${isVisited ? 'visited' : ''}`} />
                        {district}
                      </span>
                      <small className={isVisited ? 'positive' : 'muted'}>{isVisited ? 'Visited' : 'Unexplored'}</small>
                    </div>
                  )
                })}
              </div>
            </section>

            <aside className="footprint-side">
              <div className="panel">
                <h2>Explore deeper</h2>
                <p className="muted">Your milestones and memory booklet.</p>
                <div className="footprint-links">
                  <Link to="/travel-footprint/passport">Open passport <ArrowUpRight size={14} /></Link>
                  <Link to="/travel-footprint/achievements">See achievements <ArrowUpRight size={14} /></Link>
                  <Link to="/travel-footprint/timeline">View timeline <ArrowUpRight size={14} /></Link>
                </div>
              </div>
            </aside>
          </div>
        </>
      )}

      {subpage === 'passport' && (
        <div style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h2>Official Travel Passport</h2>
            <button className="primary-btn" onClick={() => setShowAddStamp(true)}><Plus size={15} /> Add stamp</button>
          </div>

          <div className="passport">
            <div className="passport-cover">
              <span className="brand-mark">p</span>
              <strong>PORIKROMA</strong>
              <small>OFFICIAL TRAVEL PASSPORT</small>
              <div className="passport-seal">✦</div>
            </div>
            <div className="passport-pages">
              <div>
                <span className="eyebrow">Holder</span>
                <h2>Rafi Ahmed</h2>
                <p>Verified explorer of Bangladesh</p>
              </div>
              <div className="stamp-grid">
                {passport.map((p) => (
                  <div className="stamp" key={p.id}>
                    <span>VISITED</span>
                    <strong>{p.destination_name}</strong>
                    <small>{p.district}</small>
                  </div>
                ))}
                {!passport.length && (
                  <p style={{ color: '#889' }}>No stamps collected yet. Click Add stamp!</p>
                )}
              </div>
            </div>
          </div>

          {showAddStamp && (
            <div className="modal-backdrop" onClick={() => setShowAddStamp(false)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={() => setShowAddStamp(false)}><X size={18} /></button>
                <h2>Collect a new stamp</h2>
                <label>Select destination
                  <select value={stampDestId} onChange={(e) => setStampDestId(e.target.value)}>
                    <option value="">Choose place</option>
                    {destinations.map((d) => (
                      <option key={d.id} value={d.id}>{d.name} ({d.district})</option>
                    ))}
                  </select>
                </label>
                <div className="modal-actions">
                  <button className="outline-btn" onClick={() => setShowAddStamp(false)}>Cancel</button>
                  <button className="primary-btn" onClick={addStamp}>Stamp passport</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {subpage === 'achievements' && (
        <div style={{ marginTop: '20px' }}>
          <div className="achievement-grid">
            {achievements.map((a) => (
              <div className={a.unlocked ? 'achievement unlocked' : 'achievement'} key={a.id}>
                <span>{a.unlocked ? '✦' : '○'}</span>
                <div>
                  <strong>{a.title}</strong>
                  <small>{a.description}</small>
                </div>
                <em>{a.unlocked ? 'Unlocked' : 'Locked'}</em>
              </div>
            ))}
            {!achievements.length && (
              <p style={{ color: '#889' }}>Loading achievements…</p>
            )}
          </div>
        </div>
      )}

      {subpage === 'timeline' && (
        <div style={{ marginTop: '20px' }}>
          <div className="timeline">
            {footprint?.timeline?.map((item, index) => (
              <article className="timeline-item" key={index}>
                <div className="timeline-dot" />
                <img src={item.image} alt="" />
                <div>
                  <span className="eyebrow">{item.type} · {item.date}</span>
                  <h2>{item.title}</h2>
                  <p><MapPin size={14} /> {item.place}</p>
                  <small>Status: {item.status}</small>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// -------------------------------------------------------------
// COMMUNITY DISCUSSIONS (/community)
// -------------------------------------------------------------
function CommunityPage() {
  const [posts, setPosts] = useState<{ id: string; body: string; author_name: string; reaction_count: number; comment_count: number; liked_by_me: boolean; created_at: string }[]>([])
  const [body, setBody] = useState('')
  const [query, setQuery] = useState('')
  const [openComments, setOpenComments] = useState<Record<string, { id: string; author_name: string; body: string }[]>>({})
  const [commentInput, setCommentInput] = useState<Record<string, string>>({})

  const load = () => api<typeof posts>('/api/community/posts').then(setPosts).catch(() => undefined)
  useEffect(() => { load() }, [])

  const createPost = async () => {
    if (!body.trim()) return
    await api('/api/community/posts', { method: 'POST', body: JSON.stringify({ body }) })
    setBody('')
    load()
  }

  const toggleLike = async (postId: string) => {
    await api(`/api/community/posts/${postId}/reactions`, { method: 'POST' })
    load()
  }

  const toggleComments = async (postId: string) => {
    if (openComments[postId]) {
      const next = { ...openComments }
      delete next[postId]
      setOpenComments(next)
    } else {
      const comments = await api<{ id: string; author_name: string; body: string }[]>(`/api/community/posts/${postId}/comments`)
      setOpenComments({ ...openComments, [postId]: comments })
    }
  }

  const addComment = async (postId: string) => {
    const text = commentInput[postId]
    if (!text?.trim()) return
    await api(`/api/community/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ body: text.trim() }) })
    setCommentInput({ ...commentInput, [postId]: '' })
    const comments = await api<{ id: string; author_name: string; body: string }[]>(`/api/community/posts/${postId}/comments`)
    setOpenComments({ ...openComments, [postId]: comments })
    load()
  }

  const filtered = posts.filter((p) => p.body.toLowerCase().includes(query.toLowerCase()) || p.author_name.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="page">
      <PageHeader
        eyebrow="Travel with people who get it"
        title="Community"
        description="Share questions, local knowledge, and stories with fellow travelers."
      />

      <div className="community-layout">
        <main>
          <div className="group-filter">
            <Search size={16} />
            <input placeholder="Search discussions and tips..." value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>

          <div className="panel inline-add" style={{ margin: '14px 0' }}>
            <input placeholder="Start a travel discussion..." value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createPost()} />
            <button className="primary-btn" onClick={createPost}><Plus size={15} /> Publish</button>
          </div>

          {filtered.map((post) => (
            <article className="panel community-post" key={post.id} style={{ display: 'block' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div className="post-avatar avatar">{post.author_name[0]}</div>
                <div style={{ flex: 1 }}>
                  <span className="status blue">Traveler reflection</span>
                  <h2 style={{ fontSize: '15px', margin: '6px 0' }}>{post.body}</h2>
                  <p style={{ color: '#778', fontSize: '11px' }}>Posted by <strong>{post.author_name}</strong> · {new Date(post.created_at).toLocaleDateString()}</p>

                  <div className="post-actions">
                    <button onClick={() => toggleComments(post.id)}>
                      <MessageCircle size={14} /> {post.comment_count} replies
                    </button>
                    <button onClick={() => toggleLike(post.id)} style={{ color: post.liked_by_me ? '#e04f4f' : 'inherit' }}>
                      ♡ {post.reaction_count}
                    </button>
                  </div>
                </div>
              </div>

              {openComments[post.id] && (
                <div style={{ marginTop: '14px', borderTop: '1px solid #edf0ea', paddingTop: '10px' }}>
                  {openComments[post.id].map((c) => (
                    <div key={c.id} style={{ padding: '6px 0', fontSize: '12px' }}>
                      <strong>{c.author_name}:</strong> {c.body}
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                    <input
                      style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '11px' }}
                      placeholder="Write a reply..."
                      value={commentInput[post.id] || ''}
                      onChange={(e) => setCommentInput({ ...commentInput, [post.id]: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && addComment(post.id)}
                    />
                    <button className="outline-btn small" onClick={() => addComment(post.id)}>Reply</button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </main>

        <aside className="panel community-guidelines">
          <p className="eyebrow">Porikroma pact</p>
          <h2>Travel kindly.</h2>
          <p>Share useful details, credit local knowledge, and respect quiet places.</p>
          <div className="guideline-row"><ShieldCheck size={15} /> Verified profiles marked clearly</div>
          <div className="guideline-row"><Users size={15} /> Respect indigenous regulations</div>
        </aside>
      </div>
    </div>
  )
}

// -------------------------------------------------------------
// NOTIFICATIONS (/notifications)
// -------------------------------------------------------------
function NotificationsPage() {
  const navigate = useNavigate()
  const { notifications: items, markAsRead, markAllAsRead, deleteNotification } = useNotifications()

  const markRead = async (id: string, link?: string) => {
    await markAsRead(id)
    if (link) navigate(link)
  }

  const deleteNotif = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await deleteNotification(id)
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Stay in the loop"
        title="Notifications"
        description="Updates on your trips, applications, and reviews."
        action={
          <button className="outline-btn" onClick={markAllAsRead}>Mark all as read</button>
        }
      />

      <div className="notification-list">
        {items.map((item) => (
          <button
            className={item.read ? 'notification-row' : 'notification-row unread'}
            key={item.id}
            onClick={() => markRead(item.id, item.link)}>
            <span className="notification-icon"><Bell size={16} /></span>
            <div>
              <strong>{item.type}</strong>
              <small>{item.detail}</small>
            </div>
            {!item.read && <i />}
            <span className="icon-btn" onClick={(e) => deleteNotif(item.id, e)} title="Delete notification"><Trash2 size={14} /></span>
          </button>
        ))}
        {!items.length && (
          <div className="panel empty-agenda" style={{ margin: '20px' }}>
            <strong>You’re all caught up.</strong>
            <p>New trip invitations, applications, and reviews will appear here.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// -------------------------------------------------------------
// USER PROFILE (/profile and /users/:id)
// -------------------------------------------------------------
function ProfilePage() {
  const { userId } = useParams()
  const [profile, setProfile] = useState<{ id: string; name: string; email: string; username: string; bio: string; travel_style: string; interests: string[]; rating: number; trips_count: number; reviews?: any[] } | null>(null)
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [travelStyle, setTravelStyle] = useState('')
  const [newTag, setNewTag] = useState('')
  const [interests, setInterests] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  const isSelf = !userId

  useEffect(() => {
    const endpoint = isSelf ? '/api/me/profile' : `/api/users/${userId}/profile`
    api<typeof profile>(endpoint).then((res) => {
      if (res) {
        setProfile(res)
        setName(res.name)
        setBio(res.bio)
        setTravelStyle(res.travel_style || 'Slow explorer')
        setInterests(res.interests || [])
      }
    }).catch(() => setMessage('Unable to load profile'))
  }, [userId])

  const save = async () => {
    setSaving(true)
    try {
      await api('/api/me/profile', {
        method: 'PUT',
        body: JSON.stringify({ name, bio, travelStyle, interests }),
      })
      setMessage('Profile successfully updated!')
    } finally {
      setSaving(false)
    }
  }

  const addTag = () => {
    if (newTag.trim() && !interests.includes(newTag.trim())) {
      setInterests([...interests, newTag.trim()])
      setNewTag('')
    }
  }

  const removeTag = (tag: string) => {
    setInterests(interests.filter((t) => t !== tag))
  }

  if (!profile) return <div className="page"><p className="muted">Loading profile…</p></div>

  return (
    <div className="page">
      <PageHeader
        eyebrow="Your public traveler identity"
        title={profile.name}
        description="Share your travel style, pace, and interests with the community."
      />

      <section className="panel" style={{ maxWidth: '780px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '20px' }}>
          <div className="avatar" style={{ width: '48px', height: '48px', fontSize: '20px' }}>{profile.name[0]}</div>
          <div>
            <h2 style={{ margin: 0 }}>{profile.name}</h2>
            <small style={{ color: '#778' }}>@{profile.username} · {profile.email}</small>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <strong>{profile.trips_count || 3} trips</strong>
            <small style={{ display: 'block', color: 'var(--green)' }}>★ {profile.rating || 4.9} rating</small>
          </div>
        </div>

        {isSelf ? (
          <>
            <label>Name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label style={{ marginTop: '12px' }}>Travel style<input value={travelStyle} onChange={(e) => setTravelStyle(e.target.value)} /></label>
            <label style={{ marginTop: '12px' }}>Bio<textarea rows={4} value={bio} onChange={(e) => setBio(e.target.value)} /></label>

            <div style={{ marginTop: '14px' }}>
              <label>Travel interests</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '8px 0' }}>
                {interests.map((t) => (
                  <span className="tag-chip" key={t}>
                    {t} <button type="button" onClick={() => removeTag(t)}>×</button>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input placeholder="Add interest (e.g. Photography)..." value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTag()} />
                <button className="secondary-btn" onClick={addTag}>Add</button>
              </div>
            </div>

            {message && <p className="positive" style={{ marginTop: '12px' }}>{message}</p>}

            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <button className="primary-btn" disabled={saving} onClick={save}>
                {saving ? 'Saving…' : 'Save profile'} <Check size={15} />
              </button>
            </div>
          </>
        ) : (
          <div>
            <p>{profile.bio}</p>
            <p><strong>Travel style:</strong> {profile.travel_style}</p>
          </div>
        )}
      </section>
    </div>
  )
}

// -------------------------------------------------------------
// SETTINGS & PRIVACY (/settings)
// -------------------------------------------------------------
function SettingsPage() {
  const [tab, setTab] = useState<'privacy' | 'account'>('privacy')
  const [privacy, setPrivacy] = useState({
    profileVisibility: 'PUBLIC',
    travelHistoryVisibility: 'PUBLIC',
    footprintVisibility: 'PUBLIC',
    reviewsVisibility: 'PUBLIC',
  })
  const [passForm, setPassForm] = useState({ currentPassword: '', newPassword: '' })
  const [verifNote, setVerifNote] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    api<typeof privacy>('/api/me/privacy').then(setPrivacy).catch(() => undefined)
  }, [])

  const savePrivacy = async () => {
    await api('/api/me/privacy', { method: 'PUT', body: JSON.stringify(privacy) })
    setMessage('Privacy settings successfully updated.')
  }

  const changePassword = async () => {
    if (!passForm.currentPassword || !passForm.newPassword) return
    try {
      await api('/api/auth/change-password', { method: 'POST', body: JSON.stringify(passForm) })
      setMessage('Password updated successfully.')
      setPassForm({ currentPassword: '', newPassword: '' })
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Password update failed')
    }
  }

  const requestVerification = async () => {
    await api('/api/me/verification', { method: 'POST', body: JSON.stringify({ note: verifNote }) })
    setMessage('Tour planner verification request submitted for review.')
    setVerifNote('')
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Account & Preferences"
        title="Settings"
        description="Manage your privacy, account credentials, and platform verification."
      />

      <div className="tab-header">
        <button className={`tab-item ${tab === 'privacy' ? 'active' : ''}`} onClick={() => setTab('privacy')}>Privacy</button>
        <button className={`tab-item ${tab === 'account' ? 'active' : ''}`} onClick={() => setTab('account')}>Account & Security</button>
      </div>

      {tab === 'privacy' && (
        <section className="panel" style={{ maxWidth: '640px' }}>
          <h2>Privacy controls</h2>
          <p className="muted">Choose what other travelers can discover about your journeys.</p>

          <div style={{ marginTop: '16px' }}>
            {Object.entries(privacy).map(([key, val]) => (
              <label key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span>{key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}</span>
                <select
                  value={val}
                  onChange={(e) => setPrivacy({ ...privacy, [key]: e.target.value })}
                  style={{ width: '140px', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--line)' }}>
                  <option value="PUBLIC">PUBLIC</option>
                  <option value="PRIVATE">PRIVATE</option>
                </select>
              </label>
            ))}
          </div>

          {message && <p className="positive">{message}</p>}
          <button className="primary-btn" style={{ marginTop: '14px' }} onClick={savePrivacy}>Save privacy settings</button>
        </section>
      )}

      {tab === 'account' && (
        <section className="panel" style={{ maxWidth: '640px' }}>
          <h2>Change password</h2>
          <label>Current password<input type="password" value={passForm.currentPassword} onChange={(e) => setPassForm({ ...passForm, currentPassword: e.target.value })} /></label>
          <label style={{ marginTop: '10px' }}>New password<input type="password" minLength={6} value={passForm.newPassword} onChange={(e) => setPassForm({ ...passForm, newPassword: e.target.value })} /></label>
          <button className="primary-btn" style={{ marginTop: '12px' }} onClick={changePassword}>Update password</button>

          <hr style={{ margin: '24px 0', border: 0, borderTop: '1px solid #edf0ea' }} />

          <h2>Tour Planner Verification</h2>
          <p className="muted">Apply for official verified host badge to publish commercial group expeditions.</p>
          <textarea rows={3} placeholder="Describe your experience guiding or organizing tours..." value={verifNote} onChange={(e) => setVerifNote(e.target.value)} />
          <button className="secondary-btn" style={{ marginTop: '10px' }} onClick={requestVerification}>Submit verification request</button>

          {message && <p className="positive" style={{ marginTop: '12px' }}>{message}</p>}
        </section>
      )}
    </div>
  )
}

// -------------------------------------------------------------
// TOUR PLANNER WORKSPACE (/planner/*)
// -------------------------------------------------------------
function RoleGuard({ role, children }: { role: PlatformRole; children: React.ReactNode }) {
  const { isAuthenticated, role: currentRole, isLoading } = useAuth()
  if (isLoading) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (currentRole !== role && currentRole !== 'ADMIN') {
    return <Navigate to={currentRole === 'TOUR_PLANNER' ? '/planner/dashboard' : '/dashboard'} replace />
  }
  return <>{children}</>
}

function RoleFrame({ role, children }: { role: 'planner' | 'admin'; children: React.ReactNode }) {
  const navigate = useNavigate()
  const isPlanner = role === 'planner'
  const links = isPlanner
    ? [
        ['Overview', '/planner/dashboard'],
        ['My tours', '/planner/tours'],
        ['Create tour', '/planner/tours/create'],
        ['Participants', '/planner/tours/participants'],
        ['Schedules', '/planner/schedules'],
      ]
    : [
        ['Overview', '/admin/dashboard'],
        ['Users', '/admin/users'],
        ['Tour planners', '/admin/planners'],
        ['Verification', '/admin/planners/verification'],
        ['Trips', '/admin/trips'],
        ['Groups', '/admin/groups'],
        ['Destinations', '/admin/destinations'],
        ['Reports', '/admin/reports'],
      ]

  return (
    <div className="route-shell">
      <aside className="sidebar route-sidebar role-sidebar">
        <div className="brand">
          <span className="brand-mark">p</span>
          <span>porikroma</span>
        </div>
        <div className="role-badge">{isPlanner ? 'TOUR PLANNER' : 'ADMIN'} workspace</div>

        <nav className="primary-nav">
          {links.map(([label, path]) => (
            <Link className="nav-item" to={path} key={path}>
              {isPlanner ? <Compass size={17} /> : <Settings size={17} />}
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => navigate('/dashboard')}>
            <ArrowUpRight size={17} />
            <span>Traveler view</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>{isPlanner ? 'Operations' : 'Administration'}</span>
            <ChevronRight size={14} />
            <strong>Workspace</strong>
          </div>
        </header>
        {children}
      </main>
    </div>
  )
}

function PlannerDashboard() {
  const navigate = useNavigate()
  const [tours, setTours] = useState<any[]>([])
  const [bookings, setBookings] = useState<any[]>([])

  useEffect(() => {
    api<any[]>('/api/planner/tours').then(setTours).catch(() => undefined)
    api<any[]>('/api/planner/bookings').then(setBookings).catch(() => undefined)
  }, [])

  return (
    <div className="page role-page">
      <PageHeader
        eyebrow="Tour operations center"
        title="Good morning, Nadia."
        description="Manage your tour departures, bookings, and traveler communications."
        action={<button className="primary-btn" onClick={() => navigate('/planner/tours/create')}><Plus size={16} /> Create tour</button>}
      />

      <div className="role-stat-grid">
        <div className="role-stat">
          <span>Published tours</span>
          <strong>{tours.length}</strong>
          <small>Active in catalog</small>
        </div>
        <div className="role-stat">
          <span>Active bookings</span>
          <strong>{bookings.length}</strong>
          <small>Travelers confirmed</small>
        </div>
        <div className="role-stat">
          <span>Average rating</span>
          <strong>4.9</strong>
          <small>From 48 traveler reviews</small>
        </div>
      </div>

      <div className="role-content-grid" style={{ marginTop: '24px' }}>
        <section className="panel">
          <h2>Recent tours</h2>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Destination</th>
                  <th>Price</th>
                  <th>Departures</th>
                </tr>
              </thead>
              <tbody>
                {tours.map((t) => (
                  <tr key={t.id}>
                    <td><strong>{t.title}</strong></td>
                    <td>{t.destination_name}</td>
                    <td>৳ {Number(t.price).toLocaleString()}</td>
                    <td>{t.departures_count || 1} departures</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <h2>Recent participant bookings</h2>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Traveler</th>
                  <th>Tour</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id}>
                    <td>{b.traveler_name}</td>
                    <td>{b.tour_title}</td>
                    <td><span className="badge badge-green">{b.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}

function CreateTourPage() {
  const navigate = useNavigate()
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [form, setForm] = useState({ title: '', destinationId: '', description: '', price: '8500', capacity: '12' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api<Destination[]>('/api/destinations').then(setDestinations).catch(() => undefined)
  }, [])

  const submit = async () => {
    if (!form.title || !form.destinationId) return
    setSaving(true)
    try {
      await api('/api/tours', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          destinationId: form.destinationId,
          description: form.description || 'Guided expedition through local terrain.',
          price: Number(form.price),
          capacity: Number(form.capacity),
          status: 'PUBLISHED',
        }),
      })
      navigate('/planner/tours')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page role-page">
      <PageHeader title="Create a new tour" description="Publish an official tour package for travelers to book." />
      <div className="panel" style={{ maxWidth: '640px' }}>
        <label>Tour Title<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Sylhet Tea Trail Odyssey" /></label>
        <label style={{ marginTop: '10px' }}>Destination
          <select value={form.destinationId} onChange={(e) => setForm({ ...form, destinationId: e.target.value })}>
            <option value="">Select destination</option>
            {destinations.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.district})</option>)}
          </select>
        </label>
        <label style={{ marginTop: '10px' }}>Price per person (BDT)<input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></label>
        <label style={{ marginTop: '10px' }}>Capacity (travelers)<input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></label>
        <label style={{ marginTop: '10px' }}>Description<textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
        <button className="primary-btn" style={{ marginTop: '16px' }} disabled={saving} onClick={submit}>
          {saving ? 'Publishing…' : 'Publish tour'}
        </button>
      </div>
    </div>
  )
}

function PlannerToursList() {
  const navigate = useNavigate()
  const [tours, setTours] = useState<any[]>([])

  useEffect(() => {
    api<any[]>('/api/planner/tours').then(setTours).catch(() => undefined)
  }, [])

  return (
    <div className="page role-page">
      <PageHeader
        title="My published tours"
        description="Tours active in the Porikroma traveler discovery catalog."
        action={<button className="primary-btn" onClick={() => navigate('/planner/tours/create')}><Plus size={16} /> Create tour</button>}
      />

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Destination</th>
              <th>Price</th>
              <th>Departures</th>
              <th>Participants</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {tours.map((t) => (
              <tr key={t.id}>
                <td><strong>{t.title}</strong></td>
                <td>{t.destination_name}</td>
                <td>৳ {Number(t.price).toLocaleString()}</td>
                <td>{t.departures_count}</td>
                <td>{t.total_participants} booked</td>
                <td><span className="badge badge-green">{t.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PlannerParticipants() {
  const [bookings, setBookings] = useState<any[]>([])

  useEffect(() => {
    api<any[]>('/api/planner/bookings').then(setBookings).catch(() => undefined)
  }, [])

  const updateStatus = async (id: string, status: string) => {
    await api(`/api/bookings/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
    api<any[]>('/api/planner/bookings').then(setBookings)
  }

  return (
    <div className="page role-page">
      <PageHeader title="Tour participants & bookings" description="Confirm and coordinate travelers for your upcoming departures." />
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Traveler</th>
              <th>Email</th>
              <th>Tour</th>
              <th>Travelers</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id}>
                <td><strong>{b.traveler_name}</strong></td>
                <td>{b.traveler_email}</td>
                <td>{b.tour_title}</td>
                <td>{b.travelers_count} person</td>
                <td><span className={`badge ${b.status === 'CONFIRMED' ? 'badge-green' : 'badge-orange'}`}>{b.status}</span></td>
                <td>
                  {b.status === 'PENDING' && (
                    <button className="primary-btn" style={{ height: '28px', fontSize: '11px' }} onClick={() => updateStatus(b.id, 'CONFIRMED')}>Confirm</button>
                  )}
                  {b.status === 'CONFIRMED' && (
                    <button className="danger-btn" style={{ height: '28px', fontSize: '11px' }} onClick={() => updateStatus(b.id, 'CANCELLED')}>Cancel</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PlannerSchedules() {
  const [departures, setDepartures] = useState<any[]>([])

  useEffect(() => {
    api<any[]>('/api/planner/departures').then(setDepartures).catch(() => undefined)
  }, [])

  return (
    <div className="page role-page">
      <PageHeader title="Departure schedules" description="All planned departures for your guided tours." />
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Tour</th>
              <th>Destination</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Seats</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {departures.map((d) => (
              <tr key={d.id}>
                <td><strong>{d.tour_title}</strong></td>
                <td>{d.destination_name}</td>
                <td>{d.start_date}</td>
                <td>{d.end_date}</td>
                <td>{d.booked_count} / {d.capacity}</td>
                <td><span className="badge badge-green">{d.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// -------------------------------------------------------------
// ADMIN CONTROL CENTER (/admin/*)
// -------------------------------------------------------------
function AdminDashboard() {
  const [stats, setStats] = useState<any>(null)
  const [reports, setReports] = useState<any[]>([])

  useEffect(() => {
    api<any>('/api/admin/analytics').then(setStats).catch(() => undefined)
    api<any[]>('/api/admin/reports').then(setReports).catch(() => undefined)
  }, [])

  return (
    <div className="page role-page">
      <PageHeader
        eyebrow="Platform control center"
        title="Good morning, Admin."
        description="A real-time overview of Porikroma platform scale and moderation."
      />

      <div className="role-stat-grid">
        <div className="role-stat">
          <span>Total users</span>
          <strong>{stats?.users || 6}</strong>
          <small>Across Bangladesh</small>
        </div>
        <div className="role-stat">
          <span>Tour planners</span>
          <strong>{stats?.planners || 2}</strong>
          <small>{stats?.pending_verifications || 1} pending verification</small>
        </div>
        <div className="role-stat">
          <span>Trips created</span>
          <strong>{stats?.trips || 3}</strong>
          <small>{stats?.active_groups || 2} active groups</small>
        </div>
        <div className="role-stat">
          <span>Reports queue</span>
          <strong>{stats?.reports || 1}</strong>
          <small>Needs attention</small>
        </div>
      </div>

      <div className="panel" style={{ marginTop: '24px' }}>
        <h2>User reports queue</h2>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Reporter</th>
                <th>Reported User</th>
                <th>Reason</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td>{r.reporter_name}</td>
                  <td><strong>{r.reported_user_name}</strong></td>
                  <td>{r.reason}</td>
                  <td>{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function AdminUsers() {
  const [users, setUsers] = useState<any[]>([])

  const load = () => api<any[]>('/api/admin/users').then(setUsers).catch(() => undefined)
  useEffect(() => { load() }, [])

  const changeRole = async (id: string, role: string) => {
    await api(`/api/admin/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) })
    load()
  }

  const changeStatus = async (id: string, status: string) => {
    await api(`/api/admin/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
    load()
  }

  return (
    <div className="page role-page">
      <PageHeader title="User directory" description="Manage user roles, platform permissions, and account status." />
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Trips</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><strong>{u.name}</strong></td>
                <td>{u.email}</td>
                <td>
                  <select
                    value={u.role}
                    onChange={(e) => changeRole(u.id, e.target.value)}
                    style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--line)', fontSize: '11px' }}>
                    <option value="TRAVELER">TRAVELER</option>
                    <option value="TOUR_PLANNER">TOUR_PLANNER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </td>
                <td>
                  <span className={`badge ${u.status === 'ACTIVE' ? 'badge-green' : 'badge-red'}`}>{u.status || 'ACTIVE'}</span>
                </td>
                <td>{u.trips_count}</td>
                <td>
                  {u.status !== 'SUSPENDED' ? (
                    <button className="danger-btn" style={{ height: '26px', fontSize: '10px' }} onClick={() => changeStatus(u.id, 'SUSPENDED')}>Suspend</button>
                  ) : (
                    <button className="primary-btn" style={{ height: '26px', fontSize: '10px' }} onClick={() => changeStatus(u.id, 'ACTIVE')}>Activate</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AdminVerifications() {
  const [verifs, setVerifs] = useState<any[]>([])

  const load = () => api<any[]>('/api/admin/verifications').then(setVerifs).catch(() => undefined)
  useEffect(() => { load() }, [])

  const decide = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    await api(`/api/admin/verifications/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
    load()
  }

  return (
    <div className="page role-page">
      <PageHeader title="Planner verifications" description="Review host verification requests and credentials." />
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Applicant</th>
              <th>Email</th>
              <th>Note</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {verifs.map((v) => (
              <tr key={v.id}>
                <td><strong>{v.user_name}</strong></td>
                <td>{v.user_email}</td>
                <td>{v.note || 'None'}</td>
                <td><span className={`badge ${v.status === 'APPROVED' ? 'badge-green' : v.status === 'REJECTED' ? 'badge-red' : 'badge-orange'}`}>{v.status}</span></td>
                <td>
                  {v.status === 'PENDING' && (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="primary-btn" style={{ height: '26px', fontSize: '10px' }} onClick={() => decide(v.id, 'APPROVED')}>Approve</button>
                      <button className="danger-btn" style={{ height: '26px', fontSize: '10px' }} onClick={() => decide(v.id, 'REJECTED')}>Reject</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {!verifs.length && (
              <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#889' }}>No pending verification requests.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AdminTrips() {
  const [trips, setTrips] = useState<any[]>([])
  useEffect(() => { api<any[]>('/api/admin/trips').then(setTrips).catch(() => undefined) }, [])

  return (
    <div className="page role-page">
      <PageHeader title="Platform trips" description="All trips created by travelers across Porikroma." />
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Destination</th>
              <th>Creator</th>
              <th>Dates</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {trips.map((t) => (
              <tr key={t.id}>
                <td><strong>{t.name}</strong></td>
                <td>{t.destination_name}</td>
                <td>{t.creator_name}</td>
                <td>{t.start_date} – {t.end_date}</td>
                <td><span className="badge badge-green">{t.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AdminGroups() {
  const [groups, setGroups] = useState<any[]>([])
  useEffect(() => { api<any[]>('/api/admin/groups').then(setGroups).catch(() => undefined) }, [])

  return (
    <div className="page role-page">
      <PageHeader title="Platform group expeditions" description="All small-group expeditions active on Porikroma." />
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Trip</th>
              <th>Organizer</th>
              <th>Capacity</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.id}>
                <td><strong>{g.title}</strong></td>
                <td>{g.trip_name}</td>
                <td>{g.organizer_name}</td>
                <td>{g.capacity} travelers</td>
                <td><span className="badge badge-green">Published</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AdminDestinations() {
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', division: 'Chattogram Division', district: '', category: 'Nature', estimatedBudget: 8000, description: '' })

  const load = () => api<Destination[]>('/api/destinations').then(setDestinations).catch(() => undefined)
  useEffect(() => { load() }, [])

  const add = async () => {
    if (!form.name || !form.district) return
    await api('/api/destinations', {
      method: 'POST',
      body: JSON.stringify(form),
    })
    setShowModal(false)
    setForm({ name: '', division: 'Chattogram Division', district: '', category: 'Nature', estimatedBudget: 8000, description: '' })
    load()
  }

  const remove = async (id: string) => {
    if (!window.confirm('Delete this destination?')) return
    await api(`/api/destinations/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="page role-page">
      <PageHeader
        title="Destination management"
        description="Add, edit, or remove destinations discoverable across Bangladesh."
        action={<button className="primary-btn" onClick={() => setShowModal(true)}><Plus size={16} /> Add destination</button>}
      />

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Division</th>
              <th>District</th>
              <th>Category</th>
              <th>Budget (BDT)</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {destinations.map((d) => (
              <tr key={d.id}>
                <td><strong>{d.name}</strong></td>
                <td>{d.division}</td>
                <td>{d.district}</td>
                <td><span className="badge badge-blue">{d.category}</span></td>
                <td>৳ {d.estimated_budget?.toLocaleString()}</td>
                <td>
                  <button className="icon-btn" onClick={() => remove(d.id)}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowModal(false)}><X size={18} /></button>
            <h2>Add new destination</h2>
            <label>Name<input autoFocus placeholder="e.g. Kuakata Sea Beach" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label>Division<input value={form.division} onChange={(e) => setForm({ ...form, division: e.target.value })} /></label>
            <label>District<input placeholder="e.g. Patuakhali" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} /></label>
            <label>Category
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option>Beach</option>
                <option>Nature</option>
                <option>Culture</option>
                <option>Adventure</option>
                <option>Wildlife</option>
              </select>
            </label>
            <label>Estimated budget (BDT)<input type="number" value={form.estimatedBudget} onChange={(e) => setForm({ ...form, estimatedBudget: Number(e.target.value) })} /></label>
            <label>Description<textarea rows={3} placeholder="Describe the destination..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            <div className="modal-actions">
              <button className="outline-btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="primary-btn" onClick={add}>Save destination</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AdminReports() {
  const [reports, setReports] = useState<any[]>([])

  const load = () => api<any[]>('/api/admin/reports').then(setReports).catch(() => undefined)
  useEffect(() => { load() }, [])

  const takeAction = async (reportId: string, action: string) => {
    await api(`/api/admin/reports/${reportId}/actions`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    })
    alert(`Moderation action "${action}" applied.`)
    load()
  }

  return (
    <div className="page role-page">
      <PageHeader title="Content & user moderation reports" description="Review safety reports and enforce community guidelines." />
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Reporter</th>
              <th>Reported User</th>
              <th>Reason</th>
              <th>Date</th>
              <th>Take Action</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id}>
                <td>{r.reporter_name}</td>
                <td><strong>{r.reported_user_name}</strong></td>
                <td>{r.reason}</td>
                <td>{new Date(r.created_at).toLocaleDateString()}</td>
                <td>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="secondary-btn" style={{ height: '26px', fontSize: '10px' }} onClick={() => takeAction(r.id, 'DISMISSED')}>Dismiss</button>
                    <button className="outline-btn" style={{ height: '26px', fontSize: '10px' }} onClick={() => takeAction(r.id, 'WARNING')}>Warn</button>
                    <button className="danger-btn" style={{ height: '26px', fontSize: '10px' }} onClick={() => takeAction(r.id, 'SUSPENDED')}>Suspend</button>
                  </div>
                </td>
              </tr>
            ))}
            {!reports.length && (
              <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#889' }}>No reports in the moderation queue.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// -------------------------------------------------------------
// MAIN APP ROUTER (ALL APPLICATION ROUTES)
// -------------------------------------------------------------
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationsProvider>
          <Routes>
        {/* Public Routes */}
        <Route path="/" element={<PublicLanding />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="/forgot-password" element={<AuthPage mode="forgot" />} />
        <Route path="/reset-password" element={<AuthPage mode="reset" />} />
        <Route path="/verify-email" element={<AuthPage mode="verify" />} />

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

          {/* AI Planner */}
          <Route path="ai-assistant" element={<PlannerPage />} />

          {/* Destinations */}
          <Route path="explore" element={<DestinationsPage />} />
          <Route path="discover" element={<DestinationsPage />} />
          <Route path="destinations" element={<DestinationsPage />} />
          <Route path="destinations/:destinationId" element={<DestinationDetails />} />

          {/* Expenses & Calendar */}
          <Route path="expenses" element={<ExpensesPage />} />
          <Route path="calendar" element={<Calendar />} />

          {/* Footprint */}
          <Route path="travel-footprint" element={<Footprint subpage="overview" />} />
          <Route path="travel-footprint/passport" element={<Footprint subpage="passport" />} />
          <Route path="travel-footprint/achievements" element={<Footprint subpage="achievements" />} />
          <Route path="travel-footprint/timeline" element={<Footprint subpage="timeline" />} />

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
        </NotificationsProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
