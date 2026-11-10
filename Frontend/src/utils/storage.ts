import type { PlatformRole, User } from '../types'

const AUTH_KEY = 'porikroma-auth'
const TOKEN_KEY = 'porikroma-token'
const ROLE_KEY = 'porikroma-role'
const USER_KEY = 'porikroma-user'

export const storage = {
  getToken: (): string | null => localStorage.getItem(TOKEN_KEY),
  setToken: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  removeToken: () => localStorage.removeItem(TOKEN_KEY),

  getRole: (): PlatformRole | null => localStorage.getItem(ROLE_KEY) as PlatformRole | null,
  setRole: (role: PlatformRole) => localStorage.setItem(ROLE_KEY, role),
  removeRole: () => localStorage.removeItem(ROLE_KEY),

  getUser: (): User | null => {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as User
    } catch {
      return null
    }
  },
  setUser: (user: User) => localStorage.setItem(USER_KEY, JSON.stringify(user)),
  removeUser: () => localStorage.removeItem(USER_KEY),

  isAuthenticated: (): boolean => localStorage.getItem(AUTH_KEY) === 'true',
  setAuthenticated: (val: boolean) => localStorage.setItem(AUTH_KEY, val ? 'true' : 'false'),

  clearSession: () => {
    localStorage.removeItem(AUTH_KEY)
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(ROLE_KEY)
    localStorage.removeItem(USER_KEY)
  },
}
