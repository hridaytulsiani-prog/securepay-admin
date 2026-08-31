// Landing page for /dashboard — headline totals plus a status breakdown,
// backed by adminpanel.api.v1.stats_views.AdminStatsView.
import { useEffect, useState } from 'react'
import { api } from '../api/client'

export default function OverviewPage() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .stats()
      .then(setStats)
      .catch((err) => setError(err.message))
  }, [])

  if (error) return <div className="error-banner">{error}</div>
  if (!stats) return <div className="loading">Loading overview…</div>

  return (
    <div>
      <h1>SecurePay - Overview</h1>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.total_orders}</div>
          <div className="stat-label">Total Orders</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">₹{Number(stats.total_amount).toLocaleString('en-IN')}</div>
          <div className="stat-label">Total Order Value</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.total_merchants}</div>
          <div className="stat-label">Merchants</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.total_enquiries}</div>
          <div className="stat-label">Enquiries</div>
        </div>
      </div>

      <div className="breakdown-grid">
        <div className="breakdown-card">
          <h3>Orders by Status</h3>
          <ul>
            {stats.orders_by_status.map((row) => (
              <li key={row.order_status}>
                <span>{row.order_status || 'unknown'}</span>
                <strong>{row.count}</strong>
              </li>
            ))}
          </ul>
        </div>
        <div className="breakdown-card">
          <h3>Enquiries by Status</h3>
          <ul>
            {stats.enquiries_by_status.map((row) => (
              <li key={row.status}>
                <span>{row.status || 'unknown'}</span>
                <strong>{row.count}</strong>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
