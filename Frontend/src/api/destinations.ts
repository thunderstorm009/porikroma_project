import { api } from './client'
import type { Destination } from '../types'

export const destinationsApi = {
  getDestinations: (query?: string) =>
    api<Destination[]>(query ? `/api/destinations?q=${encodeURIComponent(query)}` : '/api/destinations'),

  getDestination: (id: string) =>
    api<Destination & { reviews?: { id: string; author_name: string; rating: number; body: string; created_at: string }[] }>(`/api/destinations/${id}`),

  getWishlist: () =>
    api<Destination[]>('/api/me/wishlist'),

  toggleWishlist: (id: string) =>
    api<{ wishlisted: boolean }>(`/api/me/wishlist/${id}`, { method: 'POST' }),

  addReview: (data: { destinationId: string; rating: number; body: string }) =>
    api('/api/reviews', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}
