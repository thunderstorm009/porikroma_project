import { api } from './client'
import type { Tour, TourBooking } from '../types'

export const toursApi = {
  getTours: () =>
    api<Tour[]>('/api/tours'),

  getTour: (id: string) =>
    api<Tour>(`/api/tours/${id}`),

  bookDeparture: (departureId: string, travelersCount: number = 1) =>
    api<TourBooking>(`/api/departures/${departureId}/bookings`, {
      method: 'POST',
      body: JSON.stringify({ travelersCount }),
    }),

  getMyBookings: () =>
    api<TourBooking[]>('/api/me/bookings'),

  cancelBooking: (bookingId: string) =>
    api<TourBooking>(`/api/bookings/${bookingId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'CANCELLED' }),
    }),

  updateBookingStatus: (bookingId: string, status: 'CONFIRMED' | 'CANCELLED') =>
    api<TourBooking>(`/api/bookings/${bookingId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  getPlannerBookings: () =>
    api<TourBooking[]>('/api/planner/bookings'),
}

export default toursApi
