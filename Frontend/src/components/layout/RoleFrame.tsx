import React from 'react'
import { ArrowUpRight, ChevronRight, Compass, Settings } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

export interface RoleFrameProps {
  role: 'planner' | 'admin'
  children: React.ReactNode
}

export function RoleFrame({ role, children }: RoleFrameProps) {
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
