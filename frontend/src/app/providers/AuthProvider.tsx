import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { authService } from '@/features/auth/services/authService'
import type { AuthLoginPayload, AuthLoginResponse, AuthUser } from '@/shared/types/auth'

type AuthContextValue = {
  token: string | null
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (payload: AuthLoginPayload) => Promise<AuthLoginResponse>
  logout: () => void
}

const AUTH_TOKEN_STORAGE_KEY = 'access_token'

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const savedToken = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
    if (!savedToken) {
      setIsLoading(false)
      return
    }

    setToken(savedToken)
    authService
      .me(savedToken)
      .then((profile) => {
        setUser(profile)
      })
      .catch(() => {
        localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
        setToken(null)
        setUser(null)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  const login = useCallback(async (payload: AuthLoginPayload) => {
    const response = await authService.login(payload)
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, response.access_token)
    setToken(response.access_token)
    setUser(response.usuario)
    return response
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
    setToken(null)
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token),
      isLoading,
      login,
      logout,
    }),
    [token, user, isLoading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider')
  }

  return context
}
