"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { EventraUser, getMe, loginToEventra } from "./eventra-api"
import { getFirebaseAuth } from "./firebase"
import { onAuthStateChanged, signOut as fbSignOut } from "firebase/auth"

interface AuthContextType {
  user: EventraUser | null
  token: string | null
  loading: boolean
  setDevUser: (role: "admin" | "tech" | "student1") => Promise<void>
  loginWithCustomToken: (customToken: string) => Promise<EventraUser>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const STORAGE_KEY = "eventra_auth_token"
const DEV_STORAGE_USER = "eventra_dev_user"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<EventraUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Initialize session on mount
  useEffect(() => {
    async function initAuth() {
      const savedToken = localStorage.getItem(STORAGE_KEY)
      if (savedToken) {
        try {
          setToken(savedToken)
          // If mock/dev token or real token, fetch or login
          const u = await loginToEventra(savedToken)
          setUser(u)
        } catch (err) {
          console.warn("Could not restore saved session:", err)
          localStorage.removeItem(STORAGE_KEY)
          setToken(null)
          setUser(null)
        }
      } else {
        // Default to student1 for immediate preview if in dev mode
        try {
          const devToken = "mock-student1"
          const u = await loginToEventra(devToken)
          setToken(devToken)
          setUser(u)
          localStorage.setItem(STORAGE_KEY, devToken)
        } catch {
          // Dev auth not enabled or failed, keep unauthenticated
        }
      }
      setLoading(false)

      // Listen for Firebase auth state changes if configured
      try {
        const auth = getFirebaseAuth()
        const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
          if (fbUser) {
            const idToken = await fbUser.getIdToken()
            setToken(idToken)
            localStorage.setItem(STORAGE_KEY, idToken)
            try {
              const u = await loginToEventra(idToken)
              setUser(u)
            } catch (error) {
              console.error("Firebase auth login to Eventra failed:", error)
            }
          }
        })
        return () => unsubscribe()
      } catch {
        // Firebase not configured in environment
      }
    }

    initAuth()
  }, [])

  const loginWithCustomToken = async (customToken: string): Promise<EventraUser> => {
    setLoading(true)
    try {
      const loggedIn = await loginToEventra(customToken)
      setUser(loggedIn)
      setToken(customToken)
      localStorage.setItem(STORAGE_KEY, customToken)
      return loggedIn
    } finally {
      setLoading(false)
    }
  }

  const setDevUser = async (role: "admin" | "tech" | "student1") => {
    const devToken = `mock-${role}`
    await loginWithCustomToken(devToken)
  }

  const logout = async () => {
    try {
      const auth = getFirebaseAuth()
      await fbSignOut(auth)
    } catch {}
    localStorage.removeItem(STORAGE_KEY)
    setToken(null)
    setUser(null)
  }

  const refreshUser = async () => {
    if (!token) return
    try {
      const me = await getMe(token)
      setUser(me)
    } catch (err) {
      console.error("Error refreshing user:", err)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        setDevUser,
        loginWithCustomToken,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
