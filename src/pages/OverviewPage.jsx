// Landing page for /dashboard - headline totals plus a status breakdown,
// backed by adminpanel.api.v1.stats_views.AdminStatsView.
import { useEffect, useState } from 'react'
import { api } from '../api/client'

function mergeStatusRows(rows, keyName) {
  const merged = new Map()

  rows.forEach((row) => {
    const rawLabel = String(row[keyName] || 'unknown').trim()
    const key = normalizeStatusKey(rawLabel)
    const current = merged.get(key)
    merged.set(key, {
      label: prettyStatusLabel(rawLabel),
      count: (current?.count || 0) + Number(row.count || 0),
    })
  })

  return Array.from(merged.entries()).map(([key, row]) => ({ ...row, key }))
}

function normalizeStatusKey(value) {
  return String(value || 'unknown').trim().toLowerCase().replace(/\s+/g, '_')
}

function prettyStatusLabel(value) {
  return String(value || 'unknown')
    .trim()
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function completeStatusRows(rows, statuses) {
  const countsByKey = new Map(rows.map((row) => [normalizeStatusKey(row.key), Number(row.count || 0)]))
  return statuses.map((status) => ({
    key: status.key,
    label: status.label,
    count: countsByKey.get(status.key) || 0,
  }))
}

function BreakdownCard({ title, iconPath, rows }) {
  return (
    <div className="breakdown-card">
      <h3>
        <span className="breakdown-heading-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d={iconPath} />
          </svg>
        </span>
        {title}
      </h3>
      <ul>
        {rows.length === 0 ? (
          <li>
            <span>No records</span>
            <strong>0</strong>
          </li>
        ) : rows.map((row) => (
          <li key={row.key}>
            <span>{row.label}</span>
            <strong>{row.count}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}

const orderStatusIcon = 'M6.5 3.5h11A2.5 2.5 0 0 1 20 6v12a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18V6a2.5 2.5 0 0 1 2.5-2.5Zm2 4a1 1 0 0 0 0 2h7a1 1 0 1 0 0-2h-7Zm0 3.5a1 1 0 1 0 0 2h7a1 1 0 1 0 0-2h-7Zm0 3.5a1 1 0 1 0 0 2h4.5a1 1 0 1 0 0-2H8.5Z'
const enquiryStatusIcon = 'M5.5 5h13A2.5 2.5 0 0 1 21 7.5v7A2.5 2.5 0 0 1 18.5 17H12l-4.5 3v-3h-2A2.5 2.5 0 0 1 3 14.5v-7A2.5 2.5 0 0 1 5.5 5Zm2.25 4.25a1 1 0 1 0 0 2h8.5a1 1 0 1 0 0-2h-8.5Zm0 3.5a1 1 0 1 0 0 2h5.5a1 1 0 1 0 0-2h-5.5Z'
const issueStatusIcon = 'M12 3 3 7.5v6.3c0 3.8 2.9 6.2 9 7.2 6.1-1 9-3.4 9-7.2V7.5L12 3Zm0 4a1 1 0 0 1 1 1v4.3a1 1 0 1 1-2 0V8a1 1 0 0 1 1-1Zm0 9.5a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Z'
const pdfStatusIcon = 'M7 3.5h7l4 4V18A2.5 2.5 0 0 1 15.5 20.5H7A2.5 2.5 0 0 1 4.5 18V6A2.5 2.5 0 0 1 7 3.5Zm6 1.5v3.5h3.5L13 5Zm-3.9 7.35 1.75 1.75 4-4a1 1 0 1 1 1.4 1.42l-4.7 4.7a1 1 0 0 1-1.4 0L7.7 13.77a1 1 0 1 1 1.4-1.42Z'
const orderStatuses = [
  { key: 'paid', label: 'Paid to merchant' },
  { key: 'pending', label: 'Pending payout decision' },
  { key: 'refunded', label: 'Refunded to customer' },
  { key: 'settled', label: 'Settled with merchant' },
]
const customerEnquiryStatuses = [
  { key: 'new', label: 'New customer enquiry' },
  { key: 'in_progress', label: 'Customer enquiry in progress' },
  { key: 'reviewed', label: 'Customer enquiry reviewed' },
  { key: 'resolved', label: 'Customer enquiry resolved' },
]
const merchantEnquiryStatuses = [
  { key: 'new', label: 'New merchant enquiry' },
  { key: 'in_progress', label: 'Merchant enquiry in progress' },
  { key: 'reviewed', label: 'Merchant enquiry reviewed' },
  { key: 'resolved', label: 'Merchant enquiry resolved' },
]
const customerIssueStatuses = [
  { key: 'new', label: 'New customer issue' },
  { key: 'in_progress', label: 'Customer issue in progress' },
  { key: 'reviewed', label: 'Customer issue reviewed' },
  { key: 'resolved', label: 'Customer issue resolved' },
]
const merchantIssueStatuses = [
  { key: 'new', label: 'New merchant issue' },
  { key: 'in_progress', label: 'Merchant issue in progress' },
  { key: 'reviewed', label: 'Merchant issue reviewed' },
  { key: 'resolved', label: 'Merchant issue resolved' },
]
const pdfVerificationStatuses = [
  { key: 'processing', label: 'PDF verification processing' },
  { key: 'approved', label: 'PDF accepted' },
  { key: 'not_approved', label: 'PDF rejected' },
  { key: 'tracking_linked', label: 'Tracking linked to order' },
]

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

  const ordersByStatus = completeStatusRows(mergeStatusRows(stats.orders_by_status, 'order_status'), orderStatuses)
  const hasCustomerEnquiryStats = (stats.customer_enquiries_by_status || []).length > 0
  const customerEnquiriesByStatus = completeStatusRows(mergeStatusRows(stats.customer_enquiries_by_status || [], 'status'), customerEnquiryStatuses)
  const fallbackCustomerEnquiriesByStatus = completeStatusRows(mergeStatusRows(stats.enquiries_by_status, 'status'), customerEnquiryStatuses)
  const merchantEnquiriesByStatus = completeStatusRows(mergeStatusRows(stats.merchant_enquiries_by_status || [], 'status'), merchantEnquiryStatuses)
  const customerIssuesByStatus = completeStatusRows(mergeStatusRows(stats.customer_issues_by_status || [], 'status'), customerIssueStatuses)
  const merchantIssuesByStatus = completeStatusRows(mergeStatusRows(stats.merchant_issues_by_status || [], 'status'), merchantIssueStatuses)
  const pdfVerificationByStatus = completeStatusRows(mergeStatusRows(stats.pdf_verification_by_status || [], 'status'), pdfVerificationStatuses)

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
                <path d="M12 3 4 6.5v5.8c0 4.2 3.1 7.1 8 8.7 4.9-1.6 8-4.5 8-8.7V6.5L12 3Zm0 4.2a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8Zm-4 10.2a4 4 0 0 1 8 0 10.6 10.6 0 0 1-4 1.55 10.6 10.6 0 0 1-4-1.55Z" />
              </svg>
              Admin users
            </span>
            <div className="stat-value">{stats.total_admin_users ?? 0}</div>
          </div>
          <div className="stat-card">
            <span className="overview-stat-label">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5.5 5h13A2.5 2.5 0 0 1 21 7.5v7A2.5 2.5 0 0 1 18.5 17H12l-4.5 3v-3h-2A2.5 2.5 0 0 1 3 14.5v-7A2.5 2.5 0 0 1 5.5 5Zm2.25 4.25a1 1 0 1 0 0 2h8.5a1 1 0 1 0 0-2h-8.5Zm0 3.5a1 1 0 1 0 0 2h5.5a1 1 0 1 0 0-2h-5.5Z" />
              </svg>
              Customer enquiries
            </span>
            <div className="stat-value">{stats.total_customer_enquiries ?? 0}</div>
          </div>
          <div className="stat-card">
            <span className="overview-stat-label">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4.5 5h15A2.5 2.5 0 0 1 22 7.5v7A2.5 2.5 0 0 1 19.5 17H15l-3 3-3-3H4.5A2.5 2.5 0 0 1 2 14.5v-7A2.5 2.5 0 0 1 4.5 5Zm4 3.5a1 1 0 1 0 0 2h7a1 1 0 1 0 0-2h-7Zm0 3.5a1 1 0 1 0 0 2h5a1 1 0 1 0 0-2h-5Z" />
              </svg>
              Merchant enquiries
            </span>
            <div className="stat-value">{stats.total_merchant_enquiries ?? 0}</div>
          </div>
          <div className="stat-card">
            <span className="overview-stat-label">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3 3 7.5v6.3c0 3.8 2.9 6.2 9 7.2 6.1-1 9-3.4 9-7.2V7.5L12 3Zm0 4a1 1 0 0 1 1 1v4.3a1 1 0 1 1-2 0V8a1 1 0 0 1 1-1Zm0 9.5a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Z" />
              </svg>
              Customer issues
            </span>
            <div className="stat-value">{stats.total_customer_issues ?? 0}</div>
          </div>
          <div className="stat-card">
            <span className="overview-stat-label">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm3 4h6a1 1 0 1 0 0-2H9a1 1 0 0 0 0 2Zm0 4h6a1 1 0 1 0 0-2H9a1 1 0 1 0 0 2Zm0 4h3a1 1 0 1 0 0-2H9a1 1 0 1 0 0 2Z" />
              </svg>
              Merchant issues
            </span>
            <div className="stat-value">{stats.total_merchant_issues ?? 0}</div>
          </div>
        </div>
      </section>

      <section className="overview-breakdown-panel">
        <div className="breakdown-grid overview-breakdown-grid">
          <BreakdownCard title="Orders by Status" iconPath={orderStatusIcon} rows={ordersByStatus} />
          <BreakdownCard title="Customer Enquiries by Status" iconPath={enquiryStatusIcon} rows={hasCustomerEnquiryStats ? customerEnquiriesByStatus : fallbackCustomerEnquiriesByStatus} />
          <BreakdownCard title="Merchant Enquiries by Status" iconPath={enquiryStatusIcon} rows={merchantEnquiriesByStatus} />
          <BreakdownCard title="Customer Issues by Status" iconPath={issueStatusIcon} rows={customerIssuesByStatus} />
          <BreakdownCard title="Merchant Issues by Status" iconPath={issueStatusIcon} rows={merchantIssuesByStatus} />
          <BreakdownCard title="PDF Verification & Tracking" iconPath={pdfStatusIcon} rows={pdfVerificationByStatus} />
        </div>
      </section>
    </div>
  )
}
