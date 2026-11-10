import React, { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../api'
import type { PlatformRole, User } from '../types'
import { storage } from '../utils/storage'

export interface AuthContextType {
  user: User | null
  token: string | null
  role: PlatformRole | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<User>
  register: (name: string, email: string, password: string, role: PlatformRole) => Promise<User>
  demoLogin: (role: PlatformRole) => Promise<User>
  logout: () => void
  refreshUser: () => Promise<User | null>
  setUser: React.Dispatch<React.SetStateAction<User | null>>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => storage.getUser())
  const [token, setToken] = useState<string | null>(() => storage.getToken())
  const [role, setRole] = useState<PlatformRole | null>(() => storage.getRole())
  const [isLoading, setIsLoading] = useState(true)

  const persistSession = (newUser: User, newToken: string) => {
    storage.setAuthenticated(true)
    storage.setToken(newToken)
    storage.setRole(newUser.role)
    storage.setUser(newUser)
    setUser(newUser)
    setToken(newToken)
    setRole(newUser.role)
  }

  const logout = () => {
    storage.clearSession()
    setUser(null)
    setToken(null)
    setRole(null)
  }

  const refreshUser = async (): Promise<User | null> => {
    const activeToken = storage.getToken()
    if (!activeToken) {
      logout()
      setIsLoading(false)
      return null
    }
    try {
      const me = await api<User>('/api/me')
      storage.setUser(me)
      storage.setRole(me.role)
      setUser(me)
      setRole(me.role)
      return me
    } catch {
      // If token expired or invalid, clear session
      logout()
      return null
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    refreshUser()
  }, [])

  const login = async (email: string, password: string): Promise<User> => {
    const result = await api<{ user: User; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    persistSession(result.user, result.token)
    return result.user
  }

  const register = async (name: string, email: string, password: string, role: PlatformRole): Promise<User> => {
    const result = await api<{ user: User; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, role }),
    })
    persistSession(result.user, result.token)
    return result.user
  }

  const demoLogin = async (targetRole: PlatformRole): Promise<User> => {
    const result = await api<{ user: User; token: string }>('/api/auth/demo-login', {
      method: 'POST',
      body: JSON.stringify({ role: targetRole }),
    })
    persistSession(result.user, result.token)
    return result.user
  }

  const value: AuthContextType = {
    user,
    token,
    role,
    isAuthenticated: !!token && !!user,
    isLoading,
    login,
    register,
    demoLogin,
    logout,
    refreshUser,
    setUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
