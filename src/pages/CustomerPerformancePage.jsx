import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'

function pretty(value) {
  return String(value || '—').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString('en-IN') : '—'
}

function money(value, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(Number(value) || 0)
}

function normalizedState(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
}

function paymentStatusLabel(order) {
  const state = normalizedState(order.payment_state)
  const labels = {
    created: 'Payment Captured',
    payment_pending: 'Payment Captured',
    paid: 'Payment Captured',
    payment_captured: 'Payment Captured',
    funds_held: 'Payment Captured',
    settlement_eligible: 'Payment Captured',
    settlement_processing: 'Payment Processing',
    settled: 'Settled',
    payment_failed: 'Payment Failed',
    refund_pending: 'Payment Processing',
    refunded: 'Refunded',
    disputed: 'Payment Disputed',
    cancelled: 'Cancelled',
    canceled: 'Cancelled',
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

function deliveryStatusClass(value) {
  const state = normalizedState(value)
  if (['delivered', 'completed'].includes(state)) return 'status-success'
  if (['failed', 'cancelled', 'canceled', 'returned', 'rto', 'lost', 'damaged'].includes(state)) return 'status-failed'
  return 'status-pending'
}

function CustomerStatusMark({ flagged, available }) {
  return <span className={`risk-alert-mark${!available ? ' is-unavailable' : flagged ? ' is-flagged' : ' is-healthy'}`} aria-hidden="true">{!available ? <svg viewBox="0 0 24 24"><path d="M7 12h10" /></svg> : flagged ? <svg viewBox="0 0 24 24"><path d="M6 21V3" /><path className="risk-flag-cloth" d="M6 5c3.2-2.1 5.6 1.7 11-.2v8.3c-5.4 1.9-7.8-1.9-11 .2Z" /></svg> : <svg viewBox="0 0 24 24"><path d="m6.5 12.5 3.4 3.4 7.6-8" /></svg>}</span>
}

function CustomerScoreRing({ risk }) {
  if (!risk.has_score) return <div className="risk-score-ring is-unavailable"><div><strong>N/A</strong><span>not enough data</span></div></div>
  const score = Number(risk.success_rate) || 0
  return <div className={`risk-score-ring${risk.is_flagged ? '' : ' is-healthy'}`} style={{ '--risk-score': `${score * 3.6}deg` }}><div><strong>{score.toFixed(1)}%</strong><span>clean order rate</span></div></div>
}

function CustomerPerformanceList() {
  const [data, setData] = useState(null)
  const [draftQuery, setDraftQuery] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const load = useCallback(() => {
    setLoading(true); setError('')
    api.customerPerformance({ q: query, status: filter }).then(setData).catch((err) => setError(err.message)).finally(() => setLoading(false))
  }, [query, filter])
  useEffect(() => { load() }, [load])
  if (!data && loading) return <div className="panel-card">Loading customer performance...</div>
  const customers = data?.results || []
  return <div className="risk-page customer-performance-page">
    <section className="performance-workspace">
      <div className="performance-title-row"><div className="performance-title"><span className="performance-title-icon"><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3" /><path d="M3 20c.4-3.5 2.8-5.3 6-5.3s5.6 1.8 6 5.3M17 8h4M19 6v4" /></svg></span><div><h1>Customer performance</h1><p>Review repeat customers whose finalized orders repeatedly result in issues, refunds, disputes, cancellations, or returns.</p></div></div><span className="risk-count-chip"><strong>{data?.flagged_count || 0}</strong> flagged</span></div>
      <form className="performance-search customer-performance-search" onSubmit={(event) => { event.preventDefault(); setQuery(draftQuery.trim()) }}><label className="performance-search-field"><span>Search customers</span><div><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m16 16 5 5" /></svg><input value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} placeholder="Name, email, or phone" /></div></label><label className="performance-status-select"><span>Performance status</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All customers</option><option value="flagged">Flagged</option><option value="healthy">Healthy</option><option value="insufficient">Not enough data</option></select></label><div className="performance-search-actions"><button type="submit">Search</button><button type="button" onClick={load}>Refresh</button></div></form>
      <div className="performance-result-summary">Showing <strong>{customers.length}</strong> repeat customers · At least {data?.minimum_repeat_orders || 2} total orders required · Minimum {data?.minimum_orders} assessed orders and {data?.minimum_problem_orders} problem orders for review</div>
      {error ? <div className="error-banner">{error}</div> : null}
    </section>
    {customers.length ? <div className="risk-queue-grid is-performance">{customers.map((customer) => <Link className="risk-queue-card" to={`/dashboard/customer-performance/${customer.customer_id}`} key={customer.customer_id}><div className="risk-queue-card-top"><CustomerStatusMark flagged={customer.is_flagged} available={customer.has_score} /><span className={`risk-access${!customer.has_score ? ' is-unavailable' : customer.is_flagged ? '' : ' is-healthy'}`}>{!customer.has_score ? 'Not enough data' : customer.is_flagged ? 'Review needed' : 'Healthy'}</span></div><h2>{customer.customer_name}</h2><p>{customer.customer_email} · {customer.customer_phone}</p><div className={`risk-queue-score${!customer.has_score ? ' is-unavailable' : customer.is_flagged ? '' : ' is-healthy'}`}><strong>{customer.has_score ? `${customer.success_rate.toFixed(1)}%` : 'N/A'}</strong><span>clean order rate</span></div><div className={`risk-mini-bar${!customer.has_score ? ' is-unavailable' : customer.is_flagged ? '' : ' is-healthy'}`}><i style={{ width: `${customer.has_score ? customer.success_rate : 0}%` }} /></div><div className="risk-queue-stats"><span><b>{customer.total_orders}</b> total orders</span><span><b>{customer.assessed_orders}</b> assessed</span><span><b>{customer.clean_orders}</b> clean</span><span className="is-unsuccessful"><b>{customer.problem_orders}</b> problem</span></div><span className="risk-review-link">Review customer <b>→</b></span></Link>)}</div> : <div className="risk-empty"><span>✓</span><h2>No customers match this view</h2><p>Try another search or performance status.</p></div>}
  </div>
}

function CustomerPerformanceDetail({ customerId }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [view, setView] = useState('all')
  const ordersRef = useRef(null)
  useEffect(() => { api.customerPerformanceDetail(customerId).then(setData).catch((err) => setError(err.message)) }, [customerId])
  if (error) return <div className="error-banner">{error}</div>
  if (!data) return <div className="panel-card">Loading customer review...</div>
  const { customer, risk } = data
  const views = [
    { key: 'all', label: 'Total orders', count: risk.total_orders, detail: 'All recorded orders' },
    { key: 'problem', label: 'Problem orders', count: risk.problem_orders, detail: 'Orders needing review', tone: 'is-bad' },
    { key: 'clean', label: 'Clean orders', count: risk.clean_orders, detail: 'Completed without problems', tone: 'is-good' },
    { key: 'pending', label: 'Pending', count: risk.pending_orders, detail: 'Not scored yet' },
  ]
  const orders = data.orders.filter((order) => view === 'all' || order.outcome === view)
  const choose = (key) => {
    setView(key)
    window.requestAnimationFrame(() => ordersRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  return (
    <div className="risk-page customer-performance-page">
      <div className="risk-breadcrumb"><Link to="/dashboard/customer-performance">Customer Performance</Link><span>/</span><strong>{customer.customer_name}</strong></div>
      <section className="risk-hero">
        <div>
          <div className="risk-hero-kicker"><span className="risk-eyebrow">Customer performance · #{customer.id}</span><span className={`risk-access${!risk.has_score ? ' is-unavailable' : risk.is_flagged ? '' : ' is-healthy'}`}>{!risk.has_score ? 'Not enough data' : risk.is_flagged ? 'Review needed' : 'Healthy'}</span></div>
          <h1>{customer.customer_name}</h1>
          <p>{customer.customer_email} · {customer.customer_phone}</p>
        </div>
        <CustomerScoreRing risk={risk} />
      </section>
      <div className="risk-metrics">
        {views.map((item) => <button type="button" className={`${item.tone || ''}${view === item.key ? ' is-selected' : ''}`} onClick={() => choose(item.key)} key={item.key}><span>{item.label}</span><strong>{item.count}</strong><small>{item.detail}</small><i>View orders →</i></button>)}
      </div>
      <section className="panel-card risk-orders" ref={ordersRef}>
        <div className="risk-section-head">
          <div className="section-title orders-section-title risk-orders-section-title"><div className="section-title-left"><span className="orders-section-icon"><svg viewBox="0 0 24 24"><path d="M6.5 3.5h11A2.5 2.5 0 0 1 20 6v12a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18V6a2.5 2.5 0 0 1 2.5-2.5Z" /><path d="M8 8h8M8 12h8M8 16h5" /></svg></span>Order evidence</div></div>
        </div>
        <div className="risk-order-tabs">{views.map((item) => <button type="button" className={view === item.key ? 'active' : ''} onClick={() => setView(item.key)} key={item.key}>{item.label}</button>)}</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Order ID</th><th>Merchant</th><th>Amount</th><th>Payment Status</th><th>Delivery Status</th><th>Date</th></tr></thead>
            <tbody>{orders.map((order) => (
              <tr key={order.id}>
                <td><Link className="risk-order-id-link" to={`/dashboard/order-check?order=${encodeURIComponent(order.awb || order.merchant_order_id)}`}>{order.merchant_order_id}</Link></td>
                <td><Link className="merchant-history-link" to={`/dashboard/merchants/${order.merchant_id}`}>{order.merchant_name}</Link></td>
                <td>{money(order.amount, order.currency)}</td>
                <td><span className={`status-pill ${paymentStatusClass(order)}`}>{paymentStatusLabel(order)}</span></td>
                <td><span className={`status-pill ${deliveryStatusClass(order.delivery_status)}`}>{pretty(order.delivery_status)}</span></td>
                <td>{formatDate(order.order_date)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
      {data.issues.length ? <section className="panel-card customer-issue-evidence"><div className="risk-section-head"><div className="section-title orders-section-title risk-orders-section-title"><div className="section-title-left">Customer issues</div></div></div><div className="table-wrap"><table><thead><tr><th>Reference</th><th>Order</th><th>Issue Type</th><th>Status</th><th>Description</th><th>Reported</th></tr></thead><tbody>{data.issues.map((issue) => <tr key={issue.id}><td><Link className="risk-order-id-link" to={`/dashboard/customer-issues?q=${encodeURIComponent(issue.reference)}&chat=${issue.id}`}>{issue.reference}</Link></td><td><Link className="risk-order-id-link" to={`/dashboard/order-check?order=${encodeURIComponent(issue.order_ref)}`}>{issue.order_ref}</Link></td><td>{pretty(issue.issue_type)}</td><td>{pretty(issue.status)}</td><td>{issue.description}</td><td>{formatDate(issue.created_at)}</td></tr>)}</tbody></table></div></section> : null}
    </div>
  )
}

export default function CustomerPerformancePage() {
  const { customerId } = useParams()
  return customerId ? <CustomerPerformanceDetail customerId={customerId} /> : <CustomerPerformanceList />
}
