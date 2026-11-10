import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from '../api'
import type { NotificationItem } from '../types'
import { useAuth } from './AuthContext'

export interface NotificationsContextType {
  notifications: NotificationItem[]
  unreadCount: number
  isLoading: boolean
  refreshNotifications: () => Promise<void>
  markAsRead: (id: string, link?: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  deleteNotification: (id: string) => Promise<void>
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined)

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const refreshNotifications = useCallback(async () => {
    if (!isAuthenticated) {
      setNotifications([])
      return
    }
    setIsLoading(true)
    try {
      const items = await api<NotificationItem[]>('/api/notifications')
      setNotifications(items || [])
    } catch {
      // Ignored if offline or unauthenticated
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    refreshNotifications()
  }, [refreshNotifications])

  const markAsRead = async (id: string) => {
    try {
      await api(`/api/notifications/${id}/read`, { method: 'PATCH' })
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    } catch {
      // Fallback optimistic
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    }
  }

  const markAllAsRead = async () => {
    try {
      await api('/api/notifications/read-all', { method: 'PATCH' })
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    } catch {
      // Fallback optimistic
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    }
  }

  const deleteNotification = async (id: string) => {
    try {
      await api(`/api/notifications/${id}`, { method: 'DELETE' })
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    } catch {
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  const value: NotificationsContextType = {
    notifications,
    unreadCount,
    isLoading,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  }

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

export function useNotifications(): NotificationsContextType {
  const context = useContext(NotificationsContext)
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationsProvider')
  }
  return context
}
