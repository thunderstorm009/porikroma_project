import { api } from './client'

export const footprintApi = {
  getFootprint: () =>
    api<{
      districtsVisited: number
      visitedDistricts: string[]
      travelDays: number
      timeline: any[]
    }>('/api/me/footprint'),

  getPassport: () =>
    api<{
      id: string
      destination_name: string
      district: string
      division: string
      visited_on?: string
    }[]>('/api/me/passport'),

  addPassportStamp: (destinationId: string) =>
    api('/api/me/passport', {
      method: 'POST',
      body: JSON.stringify({ destinationId }),
    }),

  getAchievements: () =>
    api<{
      id: string
      title: string
      description: string
      unlocked: boolean
    }[]>('/api/me/achievements'),
}
