import { api } from './client'
import type { Destination } from '../types'

export const plannerApi = {
  // AI Copilot sessions
  getConversations: () =>
    api<{ id: string; title: string; created_at: string }[]>('/api/ai/conversations'),

  createConversation: (title: string) =>
    api<{ id: string; title: string }>('/api/ai/conversations', {
      method: 'POST',
      body: JSON.stringify({ title }),
    }),

  getConversationMessages: (convoId: string) =>
    api<{ id: string; sender: 'USER' | 'ASSISTANT'; body: string }[]>(`/api/ai/conversations/${convoId}/messages`),

  sendConversationMessage: (convoId: string, body: string) =>
    api<{ userMessage: any; assistantMessage: any }>(`/api/ai/conversations/${convoId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),

  // Tour Planner Operator portal
  getPlannerTours: () =>
    api<any[]>('/api/planner/tours'),

  createTour: (data: {
    title: string
    destinationId: string
    description: string
    price: number
    capacity: number
    status?: string
  }) =>
    api('/api/tours', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getPlannerBookings: () =>
    api<any[]>('/api/planner/bookings'),

  updateBookingStatus: (bookingId: string, status: string) =>
    api(`/api/bookings/${bookingId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  getPlannerDepartures: () =>
    api<any[]>('/api/planner/departures'),
}
