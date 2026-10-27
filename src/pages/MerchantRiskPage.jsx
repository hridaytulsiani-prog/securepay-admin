import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { hasPermission } from '../utils/roles'
import Modal from '../components/Modal'
import blueDartLogo from '../assets/couriers/blue-dart-real.png'
import delhiveryLogo from '../assets/couriers/delhivery-real.png'
import dtdcLogo from '../assets/couriers/dtdc-real.png'
import ecomExpressLogo from '../assets/couriers/ecom-express.png'
import ekartLogo from '../assets/couriers/ekart-real.png'
import shadowfaxLogo from '../assets/couriers/shadowfax.svg'
import shiprocketLogo from '../assets/couriers/shiprocket-real.png'
import xpressbeesLogo from '../assets/couriers/xpressbees-wordmark.svg'

const courierLogos = [
  { keys: ['blue dart', 'bluedart', 'blue_dart'], label: 'Blue Dart', logo: blueDartLogo },
  { keys: ['delhivery'], label: 'Delhivery', logo: delhiveryLogo },
  { keys: ['dtdc'], label: 'DTDC', logo: dtdcLogo },
  { keys: ['ecom express', 'ecomexpress', 'ecom_express'], label: 'Ecom Express', logo: ecomExpressLogo },
  { keys: ['ekart'], label: 'Ekart', logo: ekartLogo },
  { keys: ['shadowfax', 'shadow fax'], label: 'Shadowfax', logo: shadowfaxLogo },
  { keys: ['shiprocket'], label: 'Shiprocket', logo: shiprocketLogo },
  { keys: ['xpressbees', 'xpress bees', 'xpress_bees'], label: 'Xpressbees', logo: xpressbeesLogo },
]

function formatDate(value) {
  return value ? new Date(value).toLocaleString('en-IN') : '—'
}

function pretty(value) {
  return String(value || '—').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function money(value, currency = 'INR') {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '—'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount)
}

function normalizedState(value) {
  return String(value || '').trim().toLowerCase().replaceAll('-', '_').replaceAll(' ', '_')
}

function findCourierLogo(courier) {
  const normalized = String(courier || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  if (!normalized) return null
  return courierLogos.find((item) => item.keys.some((key) => normalized.includes(key.replaceAll('_', ' '))))
}

function CourierLogoCell({ courier }) {
  const match = findCourierLogo(courier)
  if (!courier) return <span className="courier-logo-empty">—</span>
  if (!match) return <span className="courier-logo-fallback">{courier}</span>
  return <span className={`courier-logo-cell courier-logo-${match.label.toLowerCase().replaceAll(' ', '-')}`} title={courier}><img src={match.logo} alt={`${match.label} logo`} /></span>
}

function paymentStatusLabel(order) {
  const state = normalizedState(order.payment_state)
  const labels = {
    created: 'Payment Captured', payment_pending: 'Payment Captured', payment_captured: 'Payment Captured',
    funds_held: 'Payment Captured', settlement_eligible: 'Payment Captured', settlement_processing: 'Payment Processing',
    settled: 'Settled', payment_failed: 'Payment Failed', refund_pending: 'Payment Processing', refunded: 'Refunded',
    disputed: 'Payment Disputed', cancelled: 'Cancelled', canceled: 'Cancelled',
  }
  return labels[state] || pretty(order.payment_state || order.order_status)
}

function paymentStatusClass(order) {
  const state = normalizedState(order.payment_state)
  if (['created', 'payment_pending', 'paid', 'payment_captured', 'funds_held', 'settlement_eligible', 'settled'].includes(state)) return 'status-paid'
  if (['settlement_processing', 'refund_pending'].includes(state)) return 'status-pending'
  if (['payment_failed', 'refunded', 'disputed', 'cancelled', 'canceled'].includes(state)) return 'status-failed'
  return 'status-pending'
}

function matchesOrderView(order, view) {
  if (view === 'all') return true
  const payment = normalizedState(order.payment_state)
  const orderStatus = normalizedState(order.order_status)
  const delivery = normalizedState(order.delivery_status)
  if (view === 'delivered') return ['delivered', 'completed'].includes(delivery)
  if (view === 'settled') return payment === 'settled'
  if (view === 'unsuccessful') {
    return ['refunded', 'refund', 'refund_completed', 'cancelled', 'canceled'].includes(payment)
      || ['refunded', 'cancelled', 'canceled'].includes(orderStatus)
  }
  return true
}

function ScoreRing({ value, available = true }) {
  if (!available) {
    return <div className="risk-score-ring is-unavailable" aria-label="Success rate not available"><div><strong>N/A</strong><span>not enough data</span></div></div>
  }
  const score = Math.max(0, Math.min(100, Number(value) || 0))
  return (
    <div className={`risk-score-ring${score >= 80 ? ' is-healthy' : ''}`} style={{ '--risk-score': `${score * 3.6}deg` }} aria-label={`${score}% merchant success rate`}>
      <div><strong>{score.toFixed(1)}%</strong><span>merchant success rate</span></div>
    </div>
  )
}

function StatusMark({ flagged, available = true }) {
  return (
    <span className={`risk-alert-mark${!available ? ' is-unavailable' : flagged ? ' is-flagged' : ' is-healthy'}`} aria-hidden="true">
      {!available ? (
        <svg viewBox="0 0 24 24"><path d="M7 12h10" /></svg>
      ) : flagged ? (
        <svg viewBox="0 0 24 24"><path d="M6 21V3" /><path className="risk-flag-cloth" d="M6 5c3.2-2.1 5.6 1.7 11-.2v8.3c-5.4 1.9-7.8-1.9-11 .2Z" /></svg>
      ) : (
        <svg viewBox="0 0 24 24"><path d="m6.5 12.5 3.4 3.4 7.6-8" /></svg>
      )}
    </span>
  )
}

function RiskQueue({ showAll = false }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [draftQuery, setDraftQuery] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('risk_first')
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    const request = showAll ? api.merchantPerformance() : api.merchantRisk()
    return request.then(setData).catch((err) => setError(err.message)).finally(() => setLoading(false))
  }, [showAll])

  useEffect(() => { load() }, [load])

  if (error && !data) return <div className="error-banner">{error}</div>
  if (!data) return <div className="panel-card">Loading merchant risk queue...</div>

  const merchants = data.results.filter((merchant) => {
    const matchesQuery = !query || `${merchant.merchant_name} ${merchant.merchant_email}`.toLowerCase().includes(query.toLowerCase())
    const matchesFilter = filter === 'all'
      || (filter === 'flagged' && merchant.is_flagged)
      || (filter === 'healthy' && merchant.has_score && !merchant.is_flagged)
      || (filter === 'blocked' && merchant.is_blocked)
      || (filter === 'unscored' && !merchant.has_score)
    return matchesQuery && matchesFilter
  }).sort((left, right) => {
    if (sort === 'highest') return (right.has_score - left.has_score) || ((right.success_rate || 0) - (left.success_rate || 0))
    if (sort === 'orders') return right.total_orders - left.total_orders
    return (right.has_score - left.has_score) || ((left.success_rate || 0) - (right.success_rate || 0))
  })

  function handleSearch(event) {
    event.preventDefault()
    setQuery(draftQuery.trim())
  }

  return (
    <div className="risk-page">
      {showAll ? <section className="performance-workspace">
        <div className="performance-title-row">
          <div className="performance-title">
            <span className="performance-title-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 19V10M10 19V5M16 19v-7M22 19V3" /><path d="M2 19h21" /></svg></span>
            <div><h1>Merchant Performance</h1><p>Merchant success rate compares settled orders with finalized payment outcomes. Refunded and cancelled orders count as unsuccessful.</p></div>
          </div>
          <span className="risk-count-chip"><strong>{data.count}</strong> merchants <i /> <b>{data.flagged_count}</b> flagged</span>
        </div>
        <form className="performance-search" onSubmit={handleSearch}>
          <label className="performance-search-field"><span>Search merchants</span><div><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m16.5 16.5 4 4" /></svg><input value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} placeholder="Merchant name or email..." /></div></label>
          <label className="performance-sort"><span>Sort by</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="risk_first">Lowest success first</option><option value="highest">Highest success first</option><option value="orders">Most orders</option></select></label>
          <label className="performance-status-select"><span>Performance status</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All merchants</option><option value="flagged">Flagged</option><option value="healthy">Healthy</option><option value="unscored">Not enough data</option><option value="blocked">Blocked</option></select></label>
          <div className="performance-search-actions"><button type="submit">Search</button><button type="button" onClick={() => { setDraftQuery(''); setQuery(''); void load() }} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</button></div>
        </form>
        <div className="performance-result-summary">Showing <strong>{merchants.length}</strong> of {data.count} merchants</div>
        {error ? <div className="error-banner">{error}</div> : null}
      </section> : <div className="risk-page-heading">
        <div><span className="risk-eyebrow">Merchant monitoring</span><h1>Merchant risk queue</h1><p>Merchants whose success rate is below the {data.threshold}% review threshold.</p></div>
        <span className="risk-count-chip">{data.count} flagged</span>
      </div>}
      {merchants.length === 0 ? (
        <div className="risk-empty"><span>✓</span><h2>{showAll ? 'No merchants match this view' : 'All merchants are healthy'}</h2><p>{showAll ? 'Try a different search or performance filter.' : `No delivery success rate is currently below ${data.threshold}%.`}</p></div>
      ) : (
        <div className={`risk-queue-grid${showAll ? ' is-performance' : ''}`}>{merchants.map((merchant) => (
          <Link className="risk-queue-card" to={`/dashboard/merchant-risk/${merchant.merchant_id}`} key={merchant.merchant_id}>
            <div className="risk-queue-card-top"><StatusMark flagged={merchant.is_flagged} available={merchant.has_score} /><span className={`risk-access is-${merchant.access_status}${!merchant.has_score ? ' is-unavailable' : !merchant.is_flagged && !merchant.is_blocked ? ' is-healthy' : ''}`}>{merchant.is_blocked ? pretty(merchant.access_status) : !merchant.has_score ? 'Not enough data' : merchant.is_flagged ? 'Review needed' : 'Healthy'}</span></div>
            <h2>{merchant.merchant_name}</h2><p>{merchant.merchant_email}</p>
            <div className={`risk-queue-score${!merchant.has_score ? ' is-unavailable' : merchant.is_flagged ? '' : ' is-healthy'}`}><strong>{merchant.has_score ? `${merchant.success_rate.toFixed(1)}%` : 'N/A'}</strong><span>merchant success rate</span></div>
            <div className={`risk-mini-bar${!merchant.has_score ? ' is-unavailable' : merchant.is_flagged ? '' : ' is-healthy'}`}><i style={{ width: `${merchant.has_score ? merchant.success_rate : 0}%` }} /></div>
            <div className="risk-queue-stats"><span><b>{merchant.total_orders}</b> total orders</span><span><b>{merchant.delivered_orders}</b> delivered</span><span><b>{merchant.successful_orders}</b> settled</span><span className="is-unsuccessful"><b>{merchant.unsuccessful_orders}</b> unsuccessful</span></div>
            <span className="risk-review-link">Review merchant <b>→</b></span>
          </Link>
        ))}</div>
      )}
    </div>
  )
}

function RiskDetail({ merchantId }) {
  const { admin } = useAuth()
  const canManage = hasPermission(admin, 'users.manage')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [blockFlow, setBlockFlow] = useState(null)
  const [duration, setDuration] = useState(7)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [orderView, setOrderView] = useState('all')
  const ordersSectionRef = useRef(null)

  const load = useCallback(() => {
    setError('')
    return api.merchantRiskDetail(merchantId).then(setData).catch((err) => setError(err.message))
  }, [merchantId])

  useEffect(() => { load() }, [load])

  function beginBlock(action) {
    setReason('')
    setDuration(7)
    setError('')
    setBlockFlow({ action, step: 'confirm' })
  }

  async function submitAccess(event, actionOverride = null) {
    event?.preventDefault()
    const action = actionOverride || blockFlow?.action
    if (!action) return
    setSaving(true); setError(''); setNotice('')
    try {
      await api.updateMerchantAccess(merchantId, { action, duration_days: Number(duration), reason })
      setNotice(action === 'unblock' ? 'New-order access restored.' : 'New-order restriction saved.')
      setReason('')
      setBlockFlow(null)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (error && !data) return <div className="error-banner">{error}</div>
  if (!data) return <div className="panel-card">Loading merchant review...</div>
  const { merchant, risk } = data
  const filteredOrders = data.recent_orders.filter((order) => matchesOrderView(order, orderView))
  const orderViews = [
    { key: 'all', label: 'Total orders', count: risk.total_orders, detail: 'All recorded orders' },
    { key: 'delivered', label: 'Delivered', count: risk.delivered_orders, detail: 'Confirmed deliveries' },
    { key: 'settled', label: 'Settled', count: risk.successful_orders, detail: 'Successful outcomes', tone: 'is-good' },
    { key: 'unsuccessful', label: 'Unsuccessful', count: risk.unsuccessful_orders, detail: 'Refunded or cancelled', tone: 'is-bad' },
  ]

  function selectOrderView(view) {
    setOrderView(view)
    window.requestAnimationFrame(() => ordersSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  return (
    <div className="risk-page">
      <div className="risk-breadcrumb"><Link to="/dashboard/merchant-performance">Merchant Performance</Link><span>/</span><strong>{merchant.merchant_name}</strong></div>
      <section className="risk-hero">
        <div><div className="risk-hero-kicker"><span className="risk-eyebrow">Merchant performance · #{merchant.id}</span><span className={`risk-access is-${risk.access_status}${!risk.has_score ? ' is-unavailable' : !risk.is_flagged && !risk.is_blocked ? ' is-healthy' : ''}`}>{risk.is_blocked ? pretty(risk.access_status) : !risk.has_score ? 'Not enough data' : risk.is_flagged ? 'Review needed' : 'Healthy'}</span></div><h1>{merchant.merchant_name}</h1><p>{merchant.merchant_email} · {merchant.merchant_phone || 'No phone recorded'}</p></div>
        {canManage && risk.is_flagged ? <div className="risk-hero-actions">{risk.is_blocked ? <button type="button" className="risk-unblock-button" onClick={() => setBlockFlow({ action: 'unblock', step: 'confirm' })}>Restore access</button> : <><button type="button" className="risk-temporary-button" onClick={() => beginBlock('temporary_block')}>Temporarily block</button><button type="button" className="risk-permanent-button" onClick={() => beginBlock('permanent_block')}>Permanently block</button></>}</div> : null}
        <ScoreRing value={risk.success_rate} available={risk.has_score} />
      </section>

      <div className="risk-metrics">
        {orderViews.map((view) => <button type="button" className={`${view.tone || ''}${orderView === view.key ? ' is-selected' : ''}`} key={view.key} onClick={() => selectOrderView(view.key)} aria-pressed={orderView === view.key}><span>{view.label}</span><strong>{view.count}</strong><small>{view.detail}</small><i>View orders →</i></button>)}
      </div>

      {notice ? <div className="success-banner risk-action-notice">{notice}</div> : null}

      <section className="panel-card risk-orders" ref={ordersSectionRef}><div className="risk-section-head"><div className="section-title orders-section-title risk-orders-section-title"><div className="section-title-left"><span className="orders-section-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6.5 3.5h11A2.5 2.5 0 0 1 20 6v12a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18V6a2.5 2.5 0 0 1 2.5-2.5Zm2 4a1 1 0 0 0 0 2h7a1 1 0 1 0 0-2h-7Zm0 3.5a1 1 0 1 0 0 2h7a1 1 0 0 0 0-2h-7Zm0 3.5a1 1 0 0 0 0 2h4.5a1 1 0 0 0 0-2H8.5Z" /></svg></span>Order evidence</div></div><Link to={`/dashboard/merchants/${merchant.id}`}>View full merchant history →</Link></div>
        <div className="risk-order-tabs" role="tablist" aria-label="Order view">{orderViews.map((view) => <button type="button" role="tab" aria-selected={orderView === view.key} className={orderView === view.key ? 'active' : ''} key={view.key} onClick={() => setOrderView(view.key)}>{view.label}</button>)}</div>
        {filteredOrders.length ? <div className="table-wrap"><table><thead><tr><th>Order ID</th><th>Customer</th><th>Amount</th><th>Payment Status</th><th>Delivery</th><th>Courier</th><th>Date</th></tr></thead><tbody>{filteredOrders.map((order) => <tr key={order.id}><td><Link className="risk-order-id-link" to={`/dashboard/order-check?order=${encodeURIComponent(order.awb || order.merchant_order_id)}`}>{order.merchant_order_id}</Link></td><td>{order.customer_name}</td><td>{money(order.amount, order.currency)}</td><td><span className={`status-pill ${paymentStatusClass(order)}`}>{paymentStatusLabel(order)}</span></td><td><span className={`status-pill status-${normalizedState(order.delivery_status)}`}>{pretty(order.delivery_status)}</span></td><td><CourierLogoCell courier={order.courier} /></td><td>{formatDate(order.order_date)}</td></tr>)}</tbody></table></div> : <div className="risk-orders-empty">No {orderViews.find((view) => view.key === orderView)?.label.toLowerCase()} found for this merchant.</div>}
      </section>

      {data.actions.length ? <section className="panel-card risk-history"><div className="risk-section-head"><div className="section-title orders-section-title risk-audit-section-title"><div className="section-title-left"><span className="orders-section-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 8v5l3 2" /><path d="M4.9 5.1A9 9 0 1 1 3 12" /><path d="M3 4v5h5" /></svg></span>Audit trail</div></div></div><div className="risk-history-table-wrap"><table className="risk-history-table"><thead><tr><th>Action</th><th>Reason</th><th>Changed By</th><th>Date &amp; Time</th><th>Restricted Until</th></tr></thead><tbody>{data.actions.map((item, index) => <tr key={`${item.created_at}-${index}`}><td><strong>{pretty(item.action)}</strong></td><td className="risk-history-reason-cell">{item.remarks || 'No reason was recorded.'}</td><td>{item.actor || 'Administrator'}</td><td>{formatDate(item.created_at)}</td><td>{item.new_values?.blocked_until ? formatDate(item.new_values.blocked_until) : '—'}</td></tr>)}</tbody></table></div></section> : null}

      {blockFlow?.step === 'confirm' ? <Modal title="Confirm order restriction" onClose={() => setBlockFlow(null)} width={480}><div className="risk-confirm-dialog"><span className="risk-confirm-icon">!</span><h3>Are you sure?</h3><p>{blockFlow.action === 'temporary_block' ? `New orders will be paused for ${merchant.merchant_name} until the restriction expires or an administrator restores access. The merchant can still sign in and manage existing orders. You will choose the duration and record the reason next.` : blockFlow.action === 'permanent_block' ? `New orders will be permanently paused for ${merchant.merchant_name}. The merchant can still sign in and manage existing orders. You will record the restriction reason next.` : `Restore new-order access for ${merchant.merchant_name}? The merchant will be able to receive and create new orders immediately.`}</p><div className="modal-footer"><button type="button" className="btn-secondary" onClick={() => setBlockFlow(null)}>Cancel</button><button type="button" className={blockFlow.action === 'permanent_block' ? 'risk-modal-danger' : ''} onClick={() => blockFlow.action === 'unblock' ? void submitAccess(null, 'unblock') : setBlockFlow({ ...blockFlow, step: 'details' })} disabled={saving}>{saving ? 'Saving...' : 'Yes, continue'}</button></div></div></Modal> : null}

{blockFlow?.step === 'details' ? <Modal title={blockFlow.action === 'temporary_block' ? 'Temporary block details' : 'Permanent block reason'} onClose={() => setBlockFlow(null)} width={520}><form className="risk-block-modal" onSubmit={submitAccess}>{blockFlow.action === 'temporary_block' ? <label>Restriction period<select value={duration} onChange={(event) => setDuration(event.target.value)}><option value="1">1 day</option><option value="3">3 days</option><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option><option value="60">60 days</option><option value="90">90 days</option></select></label> : null}<label>Block reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Write the reason for this restriction..." required /></label>{error ? <div className="error-banner">{error}</div> : null}<div className="modal-footer"><button type="submit" className="btn-secondary" disabled={saving}>{saving ? 'Applying...' : 'Confirm'}</button></div></form></Modal> : null}
    </div>
  )
}

export default function MerchantRiskPage({ showAll = false }) {
  const { merchantId } = useParams()
  return merchantId ? <RiskDetail merchantId={merchantId} /> : <RiskQueue showAll={showAll} />
}
