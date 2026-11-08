import { demoApplications, demoDestinations, demoExpenses, demoGroups, demoNotifications, demoTrips, demoUsers } from './data'
import type { MockApplication, MockExpense, MockNotification } from './types'

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const read = <T>(key: string, fallback: T): T => {
  const saved = localStorage.getItem(`porikroma-demo:${key}`)
  return saved ? JSON.parse(saved) as T : clone(fallback)
}
const write = <T>(key: string, value: T) => localStorage.setItem(`porikroma-demo:${key}`, JSON.stringify(value))

export const mockService = {
  getCurrentUser: () => demoUsers[0],
  getUsers: () => clone(demoUsers),
  getDestinations: (query = '') => demoDestinations.filter((item) => `${item.name} ${item.district} ${item.division} ${item.category}`.toLowerCase().includes(query.toLowerCase())),
  getDestination: (id: string) => demoDestinations.find((item) => item.id === id),
  getTrips: () => read('trips', demoTrips),
  getTrip: (id: string) => mockService.getTrips().find((item) => item.id === id),
  getGroups: () => read('groups', demoGroups).filter((item) => item.published),
  getGroup: (id: string) => mockService.getGroups().find((item) => item.id === id),
  getApplications: (groupId?: string) => read('applications', demoApplications).filter((item) => !groupId || item.groupId === groupId),
  updateApplication: (id: string, status: MockApplication['status']) => { const next = read('applications', demoApplications).map((item) => item.id === id ? { ...item, status } : item); write('applications', next); return next.find((item) => item.id === id) },
  getExpenses: (tripId?: string) => read('expenses', demoExpenses).filter((item) => !tripId || item.tripId === tripId),
  addExpense: (expense: MockExpense) => { const next = [...read('expenses', demoExpenses), expense]; write('expenses', next); return expense },
  getNotifications: () => read('notifications', demoNotifications),
  markNotificationRead: (id: string) => { const next = read('notifications', demoNotifications).map((item) => item.id === id ? { ...item, read: true } : item); write('notifications', next); return next },
  resetDemoData: () => ['trips', 'groups', 'applications', 'expenses', 'notifications'].forEach((key) => localStorage.removeItem(`porikroma-demo:${key}`)),
}
