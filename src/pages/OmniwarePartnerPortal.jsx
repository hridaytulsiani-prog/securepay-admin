import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { api, getPartnerToken, setPartnerToken } from '../api/client'
import OmniwareOversightPage from './OmniwareOversightPage'

export function OmniwarePartnerLoginPage() {
  const [accessToken, setAccessToken] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const data = await api.omniwarePartnerLogin(accessToken)
      setPartnerToken(data.token)
      navigate('/aggregator', { replace: true })
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-shell partner-auth-shell">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Aggregator Partner</h1>
        <p className="auth-subtitle">Restricted SecurePay oversight access</p>

        <label htmlFor="access-token">Access Token</label>
        <input
          id="access-token"
          type="password"
          value={accessToken}
          onChange={(event) => setAccessToken(event.target.value)}
          autoComplete="current-password"
          required
        />

        {error && <div className="auth-error">{error}</div>}

        <button type="submit" disabled={submitting}>
          {submitting ? 'Checking...' : 'Continue'}
        </button>
      </form>
    </div>
  )
}

export function OmniwarePartnerPortal() {
  const [token, setToken] = useState(getPartnerToken())
  const navigate = useNavigate()

  useEffect(() => {
    function handleExpired() {
      setToken(null)
      navigate('/aggregator/login', { replace: true })
    }

    window.addEventListener('securepay-partner-auth-expired', handleExpired)
    return () => window.removeEventListener('securepay-partner-auth-expired', handleExpired)
  }, [navigate])

  if (!token) return <Navigate to="/aggregator/login" replace />

  function logout() {
    setPartnerToken(null)
    setToken(null)
    navigate('/aggregator/login', { replace: true })
  }

  return (
    <div className="partner-shell">
      <header className="topbar partner-topbar">
        <div className="brand-block">
          <div className="brand">SecurePay</div>
          <div className="brand-subtitle">Aggregator Oversight</div>
        </div>
        <div className="topbar-actions">
          <span className="admin-name">Partner access</span>
          <button onClick={logout}>Logout</button>
        </div>
      </header>
      <main className="content">
        <OmniwareOversightPage partnerMode />
      </main>
    </div>
  )
}
