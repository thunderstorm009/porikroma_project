export type DemoRole = 'TRAVELER' | 'TOUR_PLANNER' | 'ADMIN'
export type TripStatus = 'DRAFT' | 'UPCOMING' | 'PLANNING' | 'COMPLETED' | 'CANCELLED'
export type ApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN'

export interface MockUser {
  id: string
  name: string
  email: string
  avatar: string
  bio: string
  location: string
  interests: string[]
  role: DemoRole
  verified: boolean
  rating: number
  reviewCount: number
  completedTrips: number
  memberSince: string
}

export interface MockDestination {
  id: string
  name: string
  division: string
  district: string
  description: string
  category: string
  estimatedBudget: number
  duration: string
  bestSeason: string
  difficulty: string
  rating: number
  reviewCount: number
  image: string
  attractions: string[]
  tip: string
}

export interface MockTrip {
  id: string
  name: string
  creatorId: string
  destinationId: string
  startDate: string
  endDate: string
  status: TripStatus
  visibility: 'PUBLIC' | 'PRIVATE'
  type: 'SOLO' | 'GROUP'
  budget: number
  spent: number
  memberIds: string[]
  description: string
}

export interface MockGroup {
  id: string
  tripId: string
  title: string
  organizerId: string
  destinationId: string
  startDate: string
  endDate: string
  capacity: number
  memberIds: string[]
  budgetPerPerson: number
  difficulty: string
  published: boolean
  image: string
}

export interface MockApplication {
  id: string
  groupId: string
  applicantId: string
  status: ApplicationStatus
  submittedAt: string
  answers: Record<string, string>
  organizerNote: string
}

export interface MockExpense {
  id: string
  tripId: string
  title: string
  category: string
  amount: number
  paidBy: string
  participantIds: string[]
  date: string
  status: 'SETTLED' | 'PENDING'
}

export interface MockNotification {
  id: string
  title: string
  detail: string
  read: boolean
  href: string
}
