import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import type { PlatformRole } from '../../types'

export interface RoleGuardProps {
  role: PlatformRole
  children: React.ReactNode
}

export function RoleGuard({ role, children }: RoleGuardProps) {
  const { isAuthenticated, role: currentRole, isLoading } = useAuth()
  if (isLoading) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (currentRole !== role && currentRole !== 'ADMIN') {
    return <Navigate to={currentRole === 'TOUR_PLANNER' ? '/planner/dashboard' : '/dashboard'} replace />
  }
  return <>{children}</>
}

export const RoleRoute = RoleGuard
