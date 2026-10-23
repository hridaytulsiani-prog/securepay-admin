import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { hasPermission } from '../utils/roles'

const ICONS = {
  attention: 'M12 3 2.5 20h19L12 3Zm0 6v5m0 3v.01',
  orders: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6m-6 4h6',
  support: 'M4 5h16v12H9l-5 4V5Zm5 5h6m-6 3h4',
  customerEnquiry: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-6 9c.6-4 2.7-6 6-6 1.4 0 2.6.4 3.5 1.1M15 8h6v7h-3l-2.5 2v-2H15V8Zm2 3h2',
  customerIssue: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 0 8Zm-6 9c.6-4 2.7-6 6-6 1.4 0 2.6.4 3.5 1.1M18 8v4m0 3v.01',
  merchantEnquiry: 'M4 9h16l-1-5H5L4 9Zm1 0v11h14V9M8 20v-6h4v6m3-8h5v5h-2l-2 2v-2h-1v-5Z',
  merchantIssue: 'M4 9h16l-1-5H5L4 9Zm1 0v11h14V9M8 20v-6h4v6m5-8v3m0 2v.01',
  verify: 'M12 3 4 6v6c0 4 3 7 8 9 5-2 8-5 8-9V6l-8-3Zm-3 9 2 2 4-5',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
}

function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

function normalize(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
}

function statusCount(rows, statuses, field = 'status') {
  const wanted = new Set(statuses.map(normalize))
  return (rows || []).reduce((total, row) => (
    wanted.has(normalize(row[field] ?? row.key)) ? total + Number(row.count || 0) : total
  ), 0)
}

function formatAmount(value, currency = 'INR') {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '-'
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `₹${amount.toLocaleString('en-IN')}`
  }
}

function formatTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  const elapsed = Date.now() - date.getTime()
  const minutes = Math.max(0, Math.floor(elapsed / 60000))
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return days < 7 ? `${days}d ago` : date.toLocaleDateString('en-IN')
}

function MetricCard({ label, value, tone = 'default', icon, to }) {
  const content = (
    <>
      <span className={`ops-metric-icon ops-tone-${tone}`}><Icon name={icon} /></span>
      <span className="ops-metric-copy">
        <span className="ops-metric-label">{label}</span>
        <strong>{value}</strong>
      </span>
    </>
  )

  return to ? <Link className="ops-metric-card" to={to}>{content}</Link> : <div className="ops-metric-card">{content}</div>
}

function SectionHeader({ title, description, link, linkLabel = 'View all', children }) {
  return (
    <div className="ops-section-header">
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      <div className="ops-section-actions">
        {children}
        {link ? <Link to={link}>{linkLabel}<Icon name="arrow" /></Link> : null}
      </div>
    </div>
  )
}

export default function OverviewPage() {
  const { admin } = useAuth()
  const canSeeAttention = hasPermission(admin, 'needs_attention.view')
  const [stats, setStats] = useState(null)
  const [attentionRows, setAttentionRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState(null)
  const [queueSort, setQueueSort] = useState('newest')

  const load = useCallback(async ({ refresh = false } = {}) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError('')

    const requests = [api.stats()]
    if (canSeeAttention) requests.push(api.needsAttention({ sort: 'newest' }))

    const results = await Promise.allSettled(requests)
    const statsResult = results[0]
    if (statsResult.status === 'fulfilled') setStats(statsResult.value)
    else setError(statsResult.reason?.message || 'Dashboard data could not be loaded.')

    if (canSeeAttention) {
      const attentionResult = results[1]
      if (attentionResult.status === 'fulfilled') setAttentionRows(attentionResult.value.results || [])
    }

    if (statsResult.status === 'fulfilled') setUpdatedAt(new Date())
    setLoading(false)
    setRefreshing(false)
  }, [canSeeAttention])

  useEffect(() => {
    load()
  }, [load])

  const dashboard = useMemo(() => {
    if (!stats) return null
    const customerEnquiries = stats.customer_enquiries_by_status?.length
      ? stats.customer_enquiries_by_status
      : stats.enquiries_by_status || []
    const merchantEnquiries = stats.merchant_enquiries_by_status || []
    const customerIssues = stats.customer_issues_by_status || []
    const merchantIssues = stats.merchant_issues_by_status || []

    return {
      activeCustomerEnquiries: statusCount(customerEnquiries, ['new', 'in_progress']),
      activeCustomerIssues: statusCount(customerIssues, ['new', 'in_progress']),
      activeMerchantEnquiries: statusCount(merchantEnquiries, ['new', 'in_progress']),
      activeMerchantIssues: statusCount(merchantIssues, ['new', 'in_progress']),
    }
  }, [stats])

  const sortedAttentionRows = useMemo(() => {
    return [...attentionRows].sort((left, right) => {
      if (queueSort === 'price_low') return Number(left.amount || 0) - Number(right.amount || 0)
      if (queueSort === 'price_high') return Number(right.amount || 0) - Number(left.amount || 0)
      const leftTime = new Date(left.created_at || 0).getTime()
      const rightTime = new Date(right.created_at || 0).getTime()
      return queueSort === 'oldest' ? leftTime - rightTime : rightTime - leftTime
    })
  }, [attentionRows, queueSort])

  if (loading) return <div className="loading">Loading dashboard...</div>
  if (!stats || !dashboard) return <div className="error-banner">{error || 'Dashboard data could not be loaded.'}</div>

  return (
    <div className="overview-page ops-dashboard">
      <header className="ops-page-header">
        <div>
          <span className="ops-eyebrow">Operations overview</span>
          <h1>Dashboard</h1>
          <p>Review today&apos;s decisions, verification exceptions, and open issues.</p>
        </div>
        <div className="ops-refresh-block">
          <span>{updatedAt ? `Updated ${updatedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ''}</span>
          <button type="button" onClick={() => load({ refresh: true })} disabled={refreshing}>
            {refreshing ? 'Refreshing...' : 'Refresh data'}
          </button>
        </div>
      </header>

      {error ? <div className="error-banner">Some dashboard sections could not be refreshed. {error}</div> : null}

      <section className="ops-priority-grid" aria-label="Open support summary">
        <MetricCard label="Customer enquiries" value={dashboard.activeCustomerEnquiries} tone="warning" icon="support" to="/dashboard/messages" />
        <MetricCard label="Customer issues" value={dashboard.activeCustomerIssues} tone="warning" icon="support" to="/dashboard/customer-issues" />
        <MetricCard label="Merchant enquiries" value={dashboard.activeMerchantEnquiries} tone="warning" icon="support" to="/dashboard/merchant-queries" />
        <MetricCard label="Merchant issues" value={dashboard.activeMerchantIssues} tone="warning" icon="support" to="/dashboard/merchant-issues" />
      </section>

      <section className="ops-panel ops-action-panel">
        <SectionHeader title="Decision & verification queue" description="Release/refund decisions and shipment checks requiring admin action." link={canSeeAttention ? '/dashboard/needs-attention' : null}>
          {canSeeAttention ? (
            <label className="ops-queue-sort" htmlFor="dashboard-queue-sort">
              <span>Arrange by</span>
              <select id="dashboard-queue-sort" value={queueSort} onChange={(event) => setQueueSort(event.target.value)}>
                <option value="newest">Newest to Oldest</option>
                <option value="oldest">Oldest to Newest</option>
                <option value="price_low">Price: low to high</option>
                <option value="price_high">Price: high to low</option>
              </select>
            </label>
          ) : null}
        </SectionHeader>
        {!canSeeAttention ? (
          <div className="ops-empty">Your role does not include access to the attention queue.</div>
        ) : attentionRows.length === 0 ? (
          <div className="ops-empty ops-empty-success"><Icon name="verify" /><strong>Queue is clear</strong><span>There are no items requiring admin action.</span></div>
        ) : (
          <div className="ops-action-list">
            {sortedAttentionRows.slice(0, 8).map((row) => {
              const orderReference = row.order_id || row.pa_order_id || ''
              const itemPath = orderReference
                ? `/dashboard/needs-attention?q=${encodeURIComponent(orderReference)}&open=${encodeURIComponent(row.id)}`
                : '/dashboard/needs-attention'
              return (
              <Link className="ops-action-item" to={itemPath} key={row.id}>
                <span className={`ops-action-state ops-action-state-${row.severity === 'danger' ? 'danger' : 'warning'}`}><Icon name={row.type === 'missing_label' ? 'orders' : 'attention'} /></span>
                <span className="ops-action-copy">
                  <strong>{row.title}</strong>
                  <span>{row.merchant_name || 'Unknown merchant'}</span>
                  <span className="ops-action-identifiers">
                    <span>Order ID: <strong>{row.order_id || row.pa_order_id || 'Not available'}</strong></span>
                    {row.pa_payment_id ? <span>Payment ID: <strong>{row.pa_payment_id}</strong></span> : null}
                  </span>
                  <small>{row.message}</small>
                </span>
                <span className="ops-action-meta">
                  <strong>{formatAmount(row.amount, row.currency)}</strong>
                  <small>{formatTime(row.created_at)}</small>
                </span>
                <span className="ops-action-open"><Icon name="arrow" /></span>
              </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
