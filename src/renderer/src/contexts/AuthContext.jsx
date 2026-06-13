import React, { createContext, useState, useContext, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if user session is saved in localStorage
    const savedUser = localStorage.getItem('admin_user')
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser))
      } catch (e) {
        console.error('Failed to parse saved user session:', e)
        localStorage.removeItem('admin_user')
      }
    }
    setLoading(false)
  }, [])

  const login = async (username, password) => {
    setLoading(true)
    try {
      const res = await window.api.login({ username, password })
      if (res.success) {
        setUser(res.user)
        localStorage.setItem('admin_user', JSON.stringify(res.user))
        return { success: true }
      } else {
        return { success: false, message: res.message }
      }
    } catch (err) {
      console.error('Auth Context Login error:', err)
      return { success: false, message: 'IPC error: Could not reach main process' }
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('admin_user')
  }

  const changePassword = async (oldPassword, newPassword) => {
    if (!user) return { success: false, message: 'Not authenticated' }
    try {
      return await window.api.changePassword({
        username: user.username,
        oldPassword,
        newPassword
      })
    } catch (err) {
      console.error('Change password error:', err)
      return { success: false, message: 'IPC error: Could not reach main process' }
    }
  }

  const value = {
    user,
    loading,
    login,
    logout,
    changePassword
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
