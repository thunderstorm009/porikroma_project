import { api } from './client'
import type { Trip, WorkspaceData } from '../types'

export const tripsApi = {
  getTrips: () => api<Trip[]>('/api/trips'),

  getTrip: (id: string) => api<Trip>(`/api/trips/${id}`),

  createTrip: (data: Partial<Trip> & { destinationId: string; startDate: string; endDate: string }) =>
    api<Trip>('/api/trips', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateTrip: (id: string, data: Partial<Trip> & Record<string, any>) =>
    api<Trip>(`/api/trips/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteTrip: (id: string) =>
    api<{ success: boolean }>(`/api/trips/${id}`, { method: 'DELETE' }),

  getWorkspace: (tripId: string) =>
    api<WorkspaceData>(`/api/trips/${tripId}/workspace`),

  // Itinerary
  addItinerary: (tripId: string, item: { dayDate: string; title: string; location?: string; notes?: string }) =>
    api(`/api/trips/${tripId}/itinerary`, {
      method: 'POST',
      body: JSON.stringify(item),
    }),

  deleteItinerary: (tripId: string, itemId: string) =>
    api(`/api/trips/${tripId}/itinerary/${itemId}`, { method: 'DELETE' }),

  // Map places
  addMapPlace: (tripId: string, place: { name: string; category?: string; notes?: string }) =>
    api(`/api/trips/${tripId}/map-places`, {
      method: 'POST',
      body: JSON.stringify(place),
    }),

  deleteMapPlace: (tripId: string, placeId: string) =>
    api(`/api/trips/${tripId}/map-places/${placeId}`, { method: 'DELETE' }),

  // Notes & Journal
  addNote: (tripId: string, note: { body: string }) =>
    api(`/api/trips/${tripId}/notes`, {
      method: 'POST',
      body: JSON.stringify(note),
    }),

  deleteNote: (tripId: string, noteId: string) =>
    api(`/api/trips/${tripId}/notes/${noteId}`, { method: 'DELETE' }),

  // Checklist
  addChecklistItem: (tripId: string, item: { title: string }) =>
    api(`/api/trips/${tripId}/checklist`, {
      method: 'POST',
      body: JSON.stringify(item),
    }),

  toggleChecklistItem: (tripId: string, itemId: string, completed: boolean) =>
    api(`/api/trips/${tripId}/checklist/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed }),
    }),

  deleteChecklistItem: (tripId: string, itemId: string) =>
    api(`/api/trips/${tripId}/checklist/${itemId}`, { method: 'DELETE' }),

  // Members
  inviteMember: (tripId: string, email: string) =>
    api(`/api/trips/${tripId}/members`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  removeMember: (tripId: string, userId: string) =>
    api(`/api/trips/${tripId}/members/${userId}`, { method: 'DELETE' }),
}
