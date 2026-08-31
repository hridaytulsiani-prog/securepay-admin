import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Gate for the /dashboard/* routes — bounces unauthenticated visitors to
// /login instead of letting them see an empty/errored dashboard.
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) return <div className="loading">Loading…</div>
  if (!isAuthenticated) return <Navigate to="/login" replace />

  return children
}
