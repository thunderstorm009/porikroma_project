import { api } from './client'
import type { GroupExpedition } from '../types'

export const groupsApi = {
  getGroups: () =>
    api<GroupExpedition[]>('/api/groups'),

  getMyGroups: () =>
    api<(GroupExpedition & { is_organizer: boolean })[]>('/api/groups/my-groups'),

  getGroup: (id: string) =>
    api<GroupExpedition & { members?: any[]; itinerary?: any[]; trip_description?: string }>(`/api/groups/${id}`),

  createGroup: (data: { tripId: string; title: string; capacity: number; budgetPerPerson: number; published: boolean }) =>
    api('/api/groups', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  applyToGroup: (groupId: string, answers: { experience: string; dietary: string; commitment: string }) =>
    api(`/api/groups/${groupId}/applications`, {
      method: 'POST',
      body: JSON.stringify(answers),
    }),

  getMyApplications: () =>
    api<{ id: string; group_title: string; organizer_name: string; status: string; destination_name: string }[]>('/api/me/group-applications'),

  updateApplicationStatus: (id: string, status: string) =>
    api(`/api/applications/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  getMessages: (groupId: string) =>
    api<{ id: string; sender_name?: string; body: string; created_at: string }[]>(`/api/groups/${groupId}/messages`),

  sendMessage: (groupId: string, body: string) =>
    api(`/api/groups/${groupId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),
}
