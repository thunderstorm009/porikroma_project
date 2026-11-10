import { api } from './client'
import type { NotificationItem } from '../types'

export const notificationsApi = {
  getNotifications: () =>
    api<NotificationItem[]>('/api/notifications'),

  markAsRead: (id: string) =>
    api(`/api/notifications/${id}/read`, { method: 'PATCH' }),

  markAllAsRead: () =>
    api('/api/notifications/read-all', { method: 'PATCH' }),

  deleteNotification: (id: string) =>
    api(`/api/notifications/${id}`, { method: 'DELETE' }),
}
