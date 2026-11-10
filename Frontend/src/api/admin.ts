import { api } from './client'
import type { Destination } from '../types'

export const adminApi = {
  getAnalytics: () =>
    api<any>('/api/admin/analytics'),

  getUsers: () =>
    api<any[]>('/api/admin/users'),

  updateUserRole: (userId: string, role: string) =>
    api(`/api/admin/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  updateUserStatus: (userId: string, status: string) =>
    api(`/api/admin/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  getVerifications: () =>
    api<any[]>('/api/admin/verifications'),

  decideVerification: (verificationId: string, status: 'APPROVED' | 'REJECTED') =>
    api(`/api/admin/verifications/${verificationId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  getTrips: () =>
    api<any[]>('/api/admin/trips'),

  getGroups: () =>
    api<any[]>('/api/admin/groups'),

  createDestination: (data: Partial<Destination> & Record<string, any>) =>
    api('/api/destinations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteDestination: (id: string) =>
    api(`/api/destinations/${id}`, { method: 'DELETE' }),

  getReports: () =>
    api<any[]>('/api/admin/reports'),

  takeReportAction: (reportId: string, action: string) =>
    api(`/api/admin/reports/${reportId}/actions`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    }),
}
