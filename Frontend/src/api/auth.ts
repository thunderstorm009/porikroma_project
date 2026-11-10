import { api } from './client'
import type { PlatformRole, User } from '../types'

export const authApi = {
  login: (email: string, password: string) =>
    api<{ user: User; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (name: string, email: string, password: string, role: PlatformRole = 'TRAVELER') =>
    api<{ user: User; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, role }),
    }),

  demoLogin: (role: PlatformRole) =>
    api<{ user: User; token: string }>('/api/auth/demo-login', {
      method: 'POST',
      body: JSON.stringify({ role }),
    }),

  getMe: () => api<User>('/api/me'),

  getProfile: (userId?: string) =>
    api<{
      id: string
      name: string
      email: string
      username: string
      bio: string
      travel_style: string
      interests: string[]
      rating: number
      trips_count: number
      reviews?: any[]
    }>(userId ? `/api/users/${userId}/profile` : '/api/me/profile'),

  updateProfile: (data: { name: string; bio: string; travelStyle: string; interests: string[] }) =>
    api('/api/me/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getPrivacy: () =>
    api<{
      profileVisibility: string
      travelHistoryVisibility: string
      footprintVisibility: string
      reviewsVisibility: string
    }>('/api/me/privacy'),

  updatePrivacy: (data: Record<string, string>) =>
    api('/api/me/privacy', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  forgotPassword: (email: string) =>
    api<{ success: boolean; message: string; resetToken?: string; resetLink?: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, password: string) =>
    api('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),

  verifyEmail: (token: string) =>
    api('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  requestVerification: (note: string) =>
    api('/api/me/verification', {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),
}
