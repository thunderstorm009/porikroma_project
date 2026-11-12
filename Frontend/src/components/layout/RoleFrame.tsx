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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
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
      {mobileMenuOpen && (
        <div className="sidebar-backdrop" onClick={() => setMobileMenuOpen(false)} />
      )}
      <aside className={`sidebar route-sidebar role-sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="brand" onClick={() => { setMobileMenuOpen(false); navigate('/') }}>
          <span className="brand-mark">p</span>
          <span>porikroma</span>
        </div>
        <div className="role-badge">{isPlanner ? 'TOUR PLANNER' : 'ADMIN'} workspace</div>

        <nav className="primary-nav">
          {links.map(([label, path]) => {
            const isActive = location.pathname === path || (path !== '/admin/dashboard' && path !== '/planner/dashboard' && location.pathname.startsWith(path))
            return (
              <Link
                className={isActive ? 'nav-item active' : 'nav-item'}
                to={path}
                key={path}
                onClick={() => setMobileMenuOpen(false)}
              >
                {isPlanner ? <Compass size={17} /> : <Settings size={17} />}
                <span>{label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => { setMobileMenuOpen(false); navigate('/dashboard') }}>
            <ArrowUpRight size={17} />
            <span>Traveler view</span>
          </button>
        </div>
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
