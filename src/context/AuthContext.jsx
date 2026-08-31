// Global auth state for the admin app: who's logged in, and login/logout
// actions. Wraps the whole app (see main.jsx) so any page can call useAuth().
//
// --- Session lifetime & what happens when it expires ------------------------
// The backend's admin session token is valid for 30 minutes of inactivity
// (adminpanel.auth.TOKEN_TTL_SECONDS), refreshed on every authenticated
// request the backend receives. This context does NOT proactively track
// that or warn the admin before it expires — there's no idle-timer here
// (contrast with securepay-client's App.jsx, the merchant frontend, which
// DOES run a client-side inactivity timer and force-logs-out on it).
// Practically: if an admin leaves this app open with no activity for 30+
// minutes, their session token dies silently server-side. The NEXT api.*()
// call any page makes will fail with a 401 "Invalid or expired admin
// session" error — see api/client.js's `request()`, which throws an Error
// with that message but does NOT itself clear the stored token or redirect
// to /login. So a page might just show that error message in its own
// `error` state (each page's own try/catch handles this) rather than
// automatically bouncing the admin back to the login screen. The token only
// actually gets cleared and the admin actually gets redirected to /login
// the next time the WHOLE APP remounts (a hard refresh / new tab), because
// THAT'S when the useEffect below re-runs and its api.me() call fails. If
// you want expiry to redirect immediately instead of on next remount, that
// would mean adding a global 401 interceptor to api/client.js's request()
// that calls setToken(null) and forces a navigation — not implemented here.
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api, getToken, setToken } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null)
  // Starts true so ProtectedRoute doesn't redirect to /login before we've
  // had a chance to check a stored token.
  const [loading, setLoading] = useState(true)

  // On first mount, if a token was left in localStorage from a previous
  // session, validate it against the backend rather than trusting it blindly.
  useEffect(() => {
    const token = getToken()
    if (!token) {
      setLoading(false)
      return
    }
    api
      .me()
      .then((data) => setAdmin(data))
      .catch(() => {
        // Token expired or was revoked server-side — clear it so the user
        // lands on the login page instead of a broken authenticated view.
        setToken(null)
        setAdmin(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (username, password) => {
    const data = await api.login(username, password)
    setToken(data.token)
    setAdmin(data.admin)
    return data
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } catch {
      // ignore network errors on logout
    }
    setToken(null)
    setAdmin(null)
  }, [])

  return (
    <AuthContext.Provider value={{ admin, loading, login, logout, isAuthenticated: !!admin }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
