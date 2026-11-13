import React, { useState } from 'react'
import { ArrowUpRight, ChevronRight, Compass, Menu, Settings, X } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

export interface RoleFrameProps {
  role: 'planner' | 'admin'
  children: React.ReactNode
}

export function RoleFrame({ role, children }: RoleFrameProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
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

  const isActive = (path: string) => {
    if (path === '/planner/dashboard' || path === '/admin/dashboard') {
      return location.pathname === path
    }
    return location.pathname.startsWith(path)
  }

  return (
    <div className="route-shell">
      {sidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`sidebar route-sidebar role-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand" onClick={() => { setSidebarOpen(false); navigate('/') }} style={{ cursor: 'pointer' }}>
          <span className="brand-mark">p</span>
          <span>porikroma</span>
        </div>
        <div className="role-badge">{isPlanner ? 'TOUR PLANNER' : 'ADMIN'} workspace</div>

        <nav className="primary-nav">
          {links.map(([label, path]) => (
            <Link
              className={isActive(path) ? 'nav-item active' : 'nav-item'}
              to={path}
              key={path}
              onClick={() => setSidebarOpen(false)}
            >
              {isPlanner ? <Compass size={18} /> : <Settings size={18} />}
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => { setSidebarOpen(false); navigate('/dashboard') }}>
            <ArrowUpRight size={18} />
            <span>Traveler view</span>
          </button>
        </div>
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
            <span>{isPlanner ? 'Operations' : 'Administration'}</span>
            <ChevronRight size={14} />
            <strong>{links.find(([, p]) => isActive(p))?.[0] || 'Workspace'}</strong>
          </div>
        </header>
        {children}
      </main>
    </div>
  )
}
