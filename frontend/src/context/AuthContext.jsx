import React, { createContext, useContext, useState, useEffect } from 'react'
import { loginApi, getMeApi } from '../api/client'

const AuthContext = createContext(null)

export const PRESET_USERS = {
  admin: { email: 'admin@odysseus.com', password: 'Admin@123', label: 'Admin (Full Access)' },
  agent: { email: 'agent@odysseus.com', password: 'Agent@123', label: 'Travel Agent (Agency)' },
  customer: { email: 'customer@odysseus.com', password: 'Customer@123', label: 'Customer (Retail)' },
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem('odysseus_token') || null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      getMeApi()
        .then(data => setUser(data.user))
        .catch(() => {
          localStorage.removeItem('odysseus_token')
          setToken(null)
          setUser(null)
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [token])

  const login = async (email, password) => {
    const data = await loginApi(email, password)
    localStorage.setItem('odysseus_token', data.token)
    setToken(data.token)
    setUser(data.user)
    return data.user
  }

  const quickSwitchRole = async (roleKey) => {
    if (!roleKey) {
      logout()
      return null
    }
    const preset = PRESET_USERS[roleKey]
    if (preset) {
      return await login(preset.email, preset.password)
    }
  }

  const logout = () => {
    localStorage.removeItem('odysseus_token')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      isAuthenticated: !!user,
      role: user ? user.role : 'guest',
      login,
      quickSwitchRole,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
