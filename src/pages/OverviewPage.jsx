// Landing page for /dashboard - headline totals plus a status breakdown,
// backed by adminpanel.api.v1.stats_views.AdminStatsView.
import { useEffect, useState } from 'react'
import { api } from '../api/client'

function mergeStatusRows(rows, keyName) {
  const merged = new Map()

  rows.forEach((row) => {
    const rawLabel = String(row[keyName] || 'unknown').trim()
    const key = rawLabel.toLowerCase()
    const current = merged.get(key)
    merged.set(key, {
      label: rawLabel.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()),
      count: (current?.count || 0) + Number(row.count || 0),
    })
  })

  return Array.from(merged.entries()).map(([key, row]) => ({ ...row, key }))
}

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
  if (!stats) return <div className="loading">Loading overview...</div>

  const ordersByStatus = mergeStatusRows(stats.orders_by_status, 'order_status')
  const enquiriesByStatus = mergeStatusRows(stats.enquiries_by_status, 'status')

  return (
    <div className="overview-page">
      <section className="overview-summary-panel">
        <div className="overview-header">
          <div className="overview-hero-copy">
            <span className="overview-eyebrow">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5.5 4h13A2.5 2.5 0 0 1 21 6.5v10A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-10A2.5 2.5 0 0 1 5.5 4Zm2 2A1.5 1.5 0 0 0 6 7.5V9h12V7.5A1.5 1.5 0 0 0 16.5 6h-9ZM6 11v5.5A.5.5 0 0 0 6.5 17h11a.5.5 0 0 0 .5-.5V11h-4v1.25a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V11H6Z" />
              </svg>
              Admin workspace
            </span>
            <h1>Operations dashboard</h1>
            <p className="overview-subtitle">Monitor orders, merchant activity, and enquiry progress in one admin workspace.</p>
          </div>
          <span className="overview-live-indicator" role="status">
            <span className="overview-live-dot" aria-hidden="true" />
            Live data
          </span>
        </div>

        <div className="stat-grid overview-stat-grid">
          <div className="stat-card">
            <span className="overview-stat-label">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 3.5h10A2.5 2.5 0 0 1 19.5 6v12a2.5 2.5 0 0 1-2.5 2.5H7A2.5 2.5 0 0 1 4.5 18V6A2.5 2.5 0 0 1 7 3.5Zm1.25 4.25a.75.75 0 0 0 0 1.5h7.5a.75.75 0 0 0 0-1.5h-7.5Zm0 3.5a.75.75 0 0 0 0 1.5h7.5a.75.75 0 0 0 0-1.5h-7.5Zm0 3.5a.75.75 0 0 0 0 1.5h4.75a.75.75 0 0 0 0-1.5H8.25Z" />
              </svg>
              Total orders
            </span>
            <div className="stat-value">{stats.total_orders}</div>
          </div>
          <div className="stat-card">
            <span className="overview-stat-label">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7.5 4.5h9a1 1 0 0 1 0 2h-2.12c.42.45.73.99.89 1.6h1.23a1 1 0 1 1 0 2h-1.23c-.41 1.58-1.76 2.76-3.71 3.05l4.11 4.74a1 1 0 0 1-1.51 1.31l-5.5-6.35A1 1 0 0 1 9.42 11h1.58c1.05 0 1.87-.34 2.22-.9H7.5a1 1 0 1 1 0-2h5.72c-.35-.56-1.17-.9-2.22-.9H7.5a1 1 0 0 1 0-2Z" />
              </svg>
              Total order value
            </span>
            <div className="stat-value">₹{Number(stats.total_amount).toLocaleString('en-IN')}</div>
          </div>
          <div className="stat-card">
            <span className="overview-stat-label">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.5 19.5v-1A4.5 4.5 0 0 1 8 14h1a4.5 4.5 0 0 1 4.5 4.5v1h-10Zm9 0v-1a5.9 5.9 0 0 0-1.02-3.31A4.45 4.45 0 0 1 15.5 14h.5a4.5 4.5 0 0 1 4.5 4.5v1h-8Z" />
              </svg>
              Merchants
            </span>
            <div className="stat-value">{stats.total_merchants}</div>
          </div>
          <div className="stat-card">
            <span className="overview-stat-label">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5.5 5h13A2.5 2.5 0 0 1 21 7.5v7A2.5 2.5 0 0 1 18.5 17H12l-4.5 3v-3h-2A2.5 2.5 0 0 1 3 14.5v-7A2.5 2.5 0 0 1 5.5 5Zm2.25 4.25a1 1 0 1 0 0 2h8.5a1 1 0 1 0 0-2h-8.5Zm0 3.5a1 1 0 1 0 0 2h5.5a1 1 0 1 0 0-2h-5.5Z" />
              </svg>
              Enquiries
            </span>
            <div className="stat-value">{stats.total_enquiries}</div>
          </div>
        </div>
      </section>

      <section className="overview-breakdown-panel">
        <div className="breakdown-grid overview-breakdown-grid">
          <div className="breakdown-card">
            <h3>
              <span className="breakdown-heading-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M6.5 3.5h11A2.5 2.5 0 0 1 20 6v12a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18V6a2.5 2.5 0 0 1 2.5-2.5Zm2 4a1 1 0 0 0 0 2h7a1 1 0 1 0 0-2h-7Zm0 3.5a1 1 0 1 0 0 2h7a1 1 0 1 0 0-2h-7Zm0 3.5a1 1 0 1 0 0 2h4.5a1 1 0 1 0 0-2H8.5Z" />
                </svg>
              </span>
              Orders by Status
            </h3>
            <ul>
              {ordersByStatus.map((row) => (
                <li key={row.key}>
                  <span>{row.label}</span>
                  <strong>{row.count}</strong>
                </li>
              ))}
            </ul>
          </div>
          <div className="breakdown-card">
            <h3>
              <span className="breakdown-heading-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M5.5 5h13A2.5 2.5 0 0 1 21 7.5v7A2.5 2.5 0 0 1 18.5 17H12l-4.5 3v-3h-2A2.5 2.5 0 0 1 3 14.5v-7A2.5 2.5 0 0 1 5.5 5Zm2.25 4.25a1 1 0 1 0 0 2h8.5a1 1 0 1 0 0-2h-8.5Zm0 3.5a1 1 0 1 0 0 2h5.5a1 1 0 1 0 0-2h-5.5Z" />
                </svg>
              </span>
              Enquiries by Status
            </h3>
            <ul>
              {enquiriesByStatus.map((row) => (
                <li key={row.key}>
                  <span>{row.label}</span>
                  <strong>{row.count}</strong>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}
