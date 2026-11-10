import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { RouteFrame } from './RouteFrame'

export function ProtectedLayout() {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return null
  return isAuthenticated ? <RouteFrame><Outlet /></RouteFrame> : <Navigate to="/login" replace />
}

export const ProtectedRoute = ProtectedLayout
