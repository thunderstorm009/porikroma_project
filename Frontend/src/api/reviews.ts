import { api } from './client'
import type { PeerReview, PeerReviewsResponse, PendingReviewCompanion } from '../types'

export async function createPeerReview(data: {
  tripId: string
  revieweeId: string
  rating: number
  comment: string
}): Promise<PeerReview> {
  return api<PeerReview>('/api/peer-reviews', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getUserPeerReviews(userId?: string): Promise<PeerReviewsResponse> {
  const endpoint = userId && userId !== 'me' ? `/api/users/${userId}/reviews` : '/api/me/reviews'
  return api<PeerReviewsResponse>(endpoint)
}

export async function getPendingPeerReviews(tripId: string): Promise<PendingReviewCompanion[]> {
  return api<PendingReviewCompanion[]>(`/api/trips/${tripId}/peer-reviews/pending`)
}
