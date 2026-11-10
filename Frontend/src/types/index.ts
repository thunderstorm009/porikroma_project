export type PlatformRole = 'TRAVELER' | 'TOUR_PLANNER' | 'ADMIN'

export interface User {
  id: string
  name: string
  email: string
  role: PlatformRole
  username?: string
  bio?: string
  avatar_url?: string
  travel_style?: string
  interests?: string[]
  rating?: number
  trips_count?: number
  status?: 'ACTIVE' | 'SUSPENDED' | 'BANNED'
}

export interface Destination {
  id: string
  name: string
  division: string
  district: string
  description: string
  category: string
  estimated_budget: number
  image?: string
  rating?: number
  review_count?: number
}

export interface Trip {
  id: string
  creator_id: string
  destination_id: string
  name: string
  start_date: string
  end_date: string
  status: 'DRAFT' | 'PLANNING' | 'UPCOMING' | 'COMPLETED' | 'CANCELLED'
  visibility: 'PUBLIC' | 'PRIVATE'
  budget: number
  description: string
  destination_name?: string
  destination_image?: string
  total_spent?: number
  member_count?: number
}

export interface GroupExpedition {
  id: string
  trip_id: string
  organizer_id: string
  title: string
  capacity: number
  budget_per_person: number
  published: boolean
  trip_name?: string
  start_date?: string
  end_date?: string
  destination_name?: string
  destination_image?: string
  organizer_name?: string
  organizer_avatar?: string
  member_count?: number
}

export interface NotificationItem {
  id: string
  type: string
  detail: string
  link?: string
  read: boolean
  created_at: string
}

export interface WorkspaceData {
  trip: Trip
  itinerary: { id: string; day_date: string; title: string; location?: string; notes?: string; sort_order: number }[]
  checklist: { id: string; title: string; completed: boolean }[]
  notes: { id: string; body: string; author_name?: string; created_at: string }[]
  photos: { id: string; url: string; caption?: string }[]
  members: { id: string; name: string; email: string; role: string }[]
  expenses: { id: string; title: string; category: string; amount: number; expense_date: string; paid_by_name: string }[]
  mapPlaces: { id: string; name: string; category: string; notes?: string }[]
  group?: GroupExpedition | null
}

export interface Tour {
  id: string
  planner_id: string
  planner_name?: string
  planner_bio?: string
  title: string
  destination_id: string
  destination_name?: string
  destination_image?: string
  district?: string
  division?: string
  duration_days?: number
  price: number
  capacity: number
  description: string
  status?: string
  departures_count?: number
  departures?: TourDeparture[]
  created_at: string
}

export interface TourDeparture {
  id: string
  tour_id: string
  start_date: string
  end_date: string
  capacity: number
  status: string
  booked_count?: number
  available_seats?: number
  created_at?: string
}

export interface TourBooking {
  id: string
  departure_id: string
  traveler_id: string
  traveler_name?: string
  traveler_email?: string
  seats: number
  total_price: number
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED'
  tour_title?: string
  tour_price?: number
  start_date?: string
  end_date?: string
  created_at: string
}

export interface Settlement {
  id: string
  from_user_id?: string
  from_user_name: string
  to_user_id?: string
  to_user_name: string
  amount: number
  status: string
  settled_at?: string
  created_at?: string
}
