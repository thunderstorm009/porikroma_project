import { api } from './client'
import type { Tour } from '../types'

export const toursApi = {
  getTours: () =>
    api<Tour[]>('/api/tours'),

  getTour: (id: string) =>
    api<Tour>(`/api/tours/${id}`),

  bookDeparture: (departureId: string, travelersCount: number = 1) =>
    api<{ id: string; status: string; travelersCount: number }>(`/api/departures/${departureId}/bookings`, {
      method: 'POST',
      body: JSON.stringify({ travelersCount }),
    }),

  getMyBookings: () =>
    api<any[]>('/api/me/bookings'),
}

export default toursApi
