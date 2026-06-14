import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'
import { authApi } from '../api/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // On app start: cookie is auto-sent. Just ask the server who we are.
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const session = await authApi.session()
        setUser(session.authenticated ? session.user : null)
      } catch {
        // Session check failed unexpectedly — leave user null.
        localStorage.removeItem('access_token')
      }
      setLoading(false)
    }
    checkAuth()
  }, [])

  const login = useCallback(async (identifier, password) => {
    const data = await authApi.login(identifier, password)
    // Server sets the httpOnly cookie. No localStorage write.
    localStorage.removeItem('access_token')
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(async () => {
    try { await authApi.logout() } catch {}
    localStorage.removeItem('access_token')
    setUser(null)
  }, [])

  const updateUser = useCallback((updatedUser) => {
    setUser(updatedUser)
  }, [])

  const value = useMemo(() => ({
    user,
    loading,
    login,
    logout,
    updateUser,
    isAuthenticated: !!user,
  }), [user, loading, login, logout, updateUser])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth ต้องใช้ภายใน AuthProvider')
  }
  return context
}
