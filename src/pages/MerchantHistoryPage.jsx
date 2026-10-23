import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
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

function normalizeCourierName(courier) {
  return String(courier || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function CourierLogoCell({ courier }) {
  const normalized = normalizeCourierName(courier)
  const match = courierLogos.find((item) => item.keys.some((key) => {
    const normalizedKey = normalizeCourierName(key)
    return normalized === normalizedKey || normalized.includes(normalizedKey)
  }))

  if (!courier) return <span className="courier-logo-empty">-</span>
  if (!match) return <span className="courier-logo-fallback">{courier}</span>

  return (
    <span className={`courier-logo-cell courier-logo-${normalizeCourierName(match.label).replaceAll(' ', '-')}`} title={courier}>
      <img src={match.logo} alt={`${match.label} logo`} />
    </span>
  )
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '-'
}

function formatMonthYear(value) {
  if (!value) return 'Not recorded'
  return new Date(value).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

function pretty(value) {
  return String(value || '-')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatPaymentStatus(value) {
  const normalized = String(value || '').trim().toUpperCase()
  const labels = {
    CREATED: 'Payment Captured',
    PAYMENT_PENDING: 'Payment Captured',
    PAYMENT_CAPTURED: 'Payment Captured',
    FUNDS_HELD: 'Payment Captured',
    SETTLEMENT_ELIGIBLE: 'Payment Captured',
    SETTLEMENT_PROCESSING: 'Payment Processing',
    SETTLED: 'Settled',
    PAYMENT_FAILED: 'Payment Failed',
    REFUND_PENDING: 'Payment Processing',
    REFUNDED: 'Refunded',
    DISPUTED: 'Payment Disputed',
    PAID: 'Payment Captured',
  }
  return labels[normalized] || pretty(value)
}

function normalizedState(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
}

function stateIncludes(value, terms) {
  const state = normalizedState(value)
  return terms.some((term) => state.includes(term))
}

function withoutRepeatedOrderIdentifiers(description) {
  return String(description || '')
    .replace(/\bfor order\s+[a-z0-9-]+/gi, 'for this order')
    .replace(/\bfor AWB\s+[a-z0-9-]+/gi, 'for this shipment')
}

function customerIssueSummary(description) {
  return String(description || '')
    .replace(/\r?\n+/g, ', ')
    .replace(/\.\s*,\s*/g, '. ')
}

function customerIssueFormDetails(issue) {
  if (!issue) return []
  const details = [...(issue.details || [])]
  if (!details.some((item) => item.key === 'additional_message')) {
    const match = String(issue.description || '').match(/Additional details:\s*([^\n]+)/i)
    if (match?.[1]?.trim()) {
      details.push({ key: 'additional_message', label: 'Additional message', value: match[1].trim() })
    }
  }
  return details
}

function customerIssueMailto(issue) {
  const subject = `Update regarding your EscroSafe ticket ${issue.reference}`
  const body = `Hello ${issue.customer_name},\n\nWe are contacting you regarding your support ticket ${issue.reference} for order/AWB ${issue.order_ref}.\n\n\n\nRegards,\nEscroSafe Support Team`
  return `mailto:${issue.customer_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

function money(value) {
  const amount = Number(value)
  return Number.isFinite(amount)
    ? `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '-'
}

function Section({ id, title, count, action, children }) {
  return (
    <section className="mh-section" id={id} tabIndex={id ? -1 : undefined}>
      <div className="mh-section-head">
        <div className="mh-section-title-group"><h2>{title}</h2><span>{count}</span></div>
        {action}
      </div>
      {children}
    </section>
  )
}

function Empty({ children }) {
  return <p className="mh-empty">{children}</p>
}

export default function MerchantHistoryPage() {
  const { merchantId } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedIssue, setSelectedIssue] = useState(null)
  const [selectedCustomerIssue, setSelectedCustomerIssue] = useState(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    api.merchantHistory(merchantId)
      .then((result) => {
        if (active) {
          setData(result)
          setError('')
        }
      })
      .catch((err) => active && setError(err.message || 'Unable to load merchant history.'))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [merchantId])

  if (loading) return <div className="panel-card mh-state">Loading merchant history...</div>
  if (error) return <div className="error-banner">{error}</div>
  if (!data) return null

  const { merchant, summary } = data
  const earliestOrderDate = data.orders.reduce((oldest, order) => {
    if (!order.order_date) return oldest
    return !oldest || new Date(order.order_date) < new Date(oldest) ? order.order_date : oldest
  }, '')
  const memberSince = merchant.created_at || earliestOrderDate
  const rejectedLabels = data.labels.filter((row) => row.status === 'not_approved')
  const merchantOrderRows = data.orders.map((order) => {
    const references = [order.merchant_order_id, order.pa_order_id, order.awb].filter(Boolean).map((value) => String(value).toLowerCase())
    const shipmentLabel = data.labels.find((item) => [item.order_id, item.awb].filter(Boolean).some((value) => references.includes(String(value).toLowerCase())))
    const merchantIssues = data.issues.filter((issue) => (issue.orders || []).some((linkedOrder) => (
      [linkedOrder.merchant_order_id, linkedOrder.order_id, linkedOrder.pa_order_id, linkedOrder.awb]
        .filter(Boolean)
        .some((value) => references.includes(String(value).toLowerCase()))
    )))
    const customerIssues = data.customer_issues.filter((issue) => references.includes(String(issue.order_ref || '').toLowerCase()))
    const preferredIssue = (issues) => issues.find((issue) => issue.status !== 'resolved') || issues[0] || null
    const issueStatuses = [...merchantIssues, ...customerIssues].map((issue) => normalizedState(issue.status))
    const issueState = issueStatuses.includes('new') ? 'open' : issueStatuses.includes('in_progress') ? 'in_progress' : issueStatuses.length ? 'resolved' : null
    const labelStatus = shipmentLabel?.status || (order.awb ? 'shipment_linked' : 'missing')
    const hasFailure = [order.payment_state, order.order_status, order.delivery_status, labelStatus]
      .some((value) => stateIncludes(value, ['failed', 'rejected', 'not_approved', 'cancelled', 'canceled', 'lost', 'damaged', 'returned', 'rto', 'refund']))
    const paymentComplete = stateIncludes(order.payment_state || order.order_status, ['paid', 'success', 'captured', 'settled', 'completed', 'released'])
    const deliveryComplete = stateIncludes(order.delivery_status, ['delivered', 'completed'])
    const labelApproved = ['approved', 'shipment_linked'].includes(normalizedState(labelStatus))
    const rowTone = issueState === 'open' || hasFailure ? 'failed' : issueState === 'in_progress' ? 'pending' : issueState === 'resolved' ? 'resolved' : paymentComplete && deliveryComplete && labelApproved ? 'success' : 'pending'
    return {
      ...order,
      merchantIssue: preferredIssue(merchantIssues),
      customerIssue: preferredIssue(customerIssues),
      rowTone,
    }
  })
  const completedDeliveryStates = new Set(['delivered', 'completed', 'cancelled', 'canceled', 'returned', 'refunded'])
  const pendingOrderCount = merchantOrderRows.filter((order) => {
    const deliveryState = String(order.delivery_status || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
    return !completedDeliveryStates.has(deliveryState)
  }).length
  const courierSetupEmail = `mailto:${merchant.merchant_email}?cc=${encodeURIComponent('partnerships@escrosafe.com')}&subject=${encodeURIComponent('Action required: Complete your EscroSafe courier setup')}&body=${encodeURIComponent(`Hello ${merchant.merchant_name},\n\nYour courier setup on EscroSafe is still pending. Please sign in to your merchant dashboard and complete the courier setup so your shipments can be processed without interruption.\n\nIf you need any help, reply to this email and our partnerships team will assist you.\n\nRegards,\nEscroSafe Partnerships Team`)}`

  function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId)
    if (!section) return
    section.scrollIntoView({ behavior: 'smooth', block: 'start' })
    window.setTimeout(() => section.focus({ preventScroll: true }), 450)
  }
  return (
    <div className="mh-page">
      <div className="mh-breadcrumb"><Link to="/dashboard/merchant-users">Merchants</Link><span>/</span><strong>{merchant.merchant_name}</strong></div>

      <header className="panel-card mh-hero">
        <span className="mh-kicker">Merchant #{merchant.id}</span>
        <h1>{merchant.merchant_name}</h1>
        <div className="mh-contact-line">
          <span>{merchant.merchant_email}</span>
          <b aria-hidden="true">•</b>
          <span>{merchant.merchant_phone || 'No phone'}</span>
          <b aria-hidden="true">•</b>
          <span>{merchant.merchant_address || 'No address recorded'}</span>
        </div>
        <div className="mh-hero-meta">
          {merchant.courier_setup_completed ? (
            <span className="status-pill status-approved">Courier setup complete</span>
          ) : (
            <div className="mh-setup-action">
              <span className="status-pill status-pending mh-setup-chip" tabIndex={0}>Courier setup pending</span>
              <div className="mh-setup-tooltip" role="tooltip">
                <span>Courier setup is incomplete</span>
                <a href={courierSetupEmail} title={`Email ${merchant.merchant_name} about pending courier setup`}>
                  Email merchant
                </a>
              </div>
            </div>
          )}
        </div>
        <small className="mh-member-since">Member since : <strong>{formatMonthYear(memberSince)}</strong></small>
      </header>

      <div className="mh-metrics">
        <div className="mh-order-metric"><span>Total orders</span><strong>{merchantOrderRows.length}</strong></div>
        <div className="mh-order-metric"><span>Pending orders</span><strong>{pendingOrderCount}</strong></div>
        <button type="button" onClick={() => scrollToSection('merchant-issues')}><span>Merchant issues</span><strong>{data.issues.length}</strong><em>View section →</em></button>
        <button type="button" onClick={() => scrollToSection('customer-issues')}><span>Customer issues</span><strong>{summary.customer_issue_count}</strong><em>View section →</em></button>
        <button type="button" onClick={() => scrollToSection('rejected-labels')}><span>Rejected labels</span><strong>{summary.suspicious_label_count}</strong><em>View section →</em></button>
      </div>

      <Section
        title="Merchant orders"
        count={merchantOrderRows.length}
        action={<div className="mh-order-legend" aria-label="Order row colour guide"><span className="is-success">Successful</span><span className="is-pending">Ongoing</span><span className="is-failed">Failed / new issue</span><span className="is-resolved">Issues resolved</span></div>}
      >
        {merchantOrderRows.length === 0 ? <Empty>This merchant has no orders yet.</Empty> : (
          <div className="mh-order-detail-wrap">
            <table className="mh-order-detail-table">
              <thead><tr><th>Order ID</th><th>AWB</th><th>Payment ID</th><th>Customer</th><th>Amount</th><th>Payment status</th><th>Delivery status</th><th>Courier label</th><th>Merchant issue</th><th>Customer issue</th><th>Date</th></tr></thead>
              <tbody>{merchantOrderRows.map((order) => {
                const reportPath = `/dashboard/order-check?order=${encodeURIComponent(order.awb || order.merchant_order_id || order.pa_order_id)}`
                return <tr className={`mh-order-state-row is-${order.rowTone}`} key={order.id}>
                  <td><Link className="orders-data-link" to={reportPath}>{order.merchant_order_id}</Link></td>
                  <td>{order.awb ? <Link className="orders-data-link" to={reportPath}>{order.awb}</Link> : '-'}</td>
                  <td><Link className="orders-data-link" to={reportPath}>{order.display_payment_id || order.pa_payment_id || '-'}</Link></td>
                  <td><strong>{order.customer_name}</strong><small>{order.customer_phone || order.customer_email || '-'}</small></td>
                  <td>{money(order.amount)}</td>
                  <td><span className={`mh-order-pill is-${String(order.payment_state || '').toLowerCase()}`}>{pretty(order.payment_state || order.order_status)}</span></td>
                  <td><span className={`mh-order-pill is-${String(order.delivery_status || '').toLowerCase()}`}>{pretty(order.delivery_status || 'Not shipped')}</span></td>
                  <td><CourierLogoCell courier={order.courier} /></td>
                  <td>{order.merchantIssue ? <Link className="orders-data-link" to={`/dashboard/merchant-issues?q=${encodeURIComponent(order.merchantIssue.reference)}&chat=${order.merchantIssue.id}`}>{order.merchantIssue.reference}</Link> : '-'}</td>
                  <td>{order.customerIssue ? <Link className="orders-data-link" to={`/dashboard/customer-issues?q=${encodeURIComponent(order.customerIssue.reference)}&chat=${order.customerIssue.id}`}>{order.customerIssue.reference}</Link> : '-'}</td>
                  <td>{formatDate(order.order_date)}</td>
                </tr>
              })}</tbody>
            </table>
          </div>
        )}
      </Section>

      <Section
        id="merchant-issues"
        title="Merchant issues"
        count={data.issues.length}
        action={data.issues.length > 0 ? <Link className="mh-view-all" to={`/dashboard/merchant-issues?q=${encodeURIComponent(merchant.merchant_email)}`}>View all <span aria-hidden="true">→</span></Link> : null}
      >
          {data.issues.length === 0 ? <Empty>No merchant issues have been raised. This merchant currently has no reported support problems.</Empty> : (
            <div className="mh-ticket-list">{data.issues.slice(0, 5).map((issue) => (
              <button className="mh-ticket" key={issue.id} type="button" onClick={() => setSelectedIssue(issue)}>
                <span className={`mh-ticket-icon is-${issue.status}`} aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M12 3 2.8 20h18.4L12 3Zm0 6v5m0 3v.1" /></svg>
                </span>
                <div className="mh-ticket-copy">
                  <strong>{issue.issue_type_label}</strong>
                  <span><strong className="mh-ticket-id">Ticket ID : {issue.reference}</strong> · {issue.orders.length} linked order{issue.orders.length === 1 ? '' : 's'}</span>
                  <p>{issue.description}</p>
                </div>
                <div className="mh-ticket-meta">
                  <span className={`status-pill status-${issue.status}`}>{issue.status_label}</span>
                  <small>{formatDate(issue.created_at)}</small>
                </div>
                <span className="mh-ticket-arrow" aria-hidden="true">→</span>
              </button>
            ))}</div>
          )}
      </Section>
      <Section
        id="customer-issues"
        title="Customer issues"
        count={data.customer_issues.length}
        action={data.customer_issues.length > 0 ? <Link className="mh-view-all" to={`/dashboard/customer-issues?merchant_id=${merchant.id}`}>View all <span aria-hidden="true">→</span></Link> : null}
      >
          {data.customer_issues.length === 0 ? <Empty>No customer issues are linked to this merchant's orders. There are no customer-reported problems to review.</Empty> : (
            <div className="mh-ticket-list">{data.customer_issues.slice(0, 5).map((issue) => (
              <button className="mh-ticket" key={issue.id} type="button" onClick={() => setSelectedCustomerIssue(issue)}>
                <span className={`mh-ticket-icon is-${issue.status}`} aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M12 3 2.8 20h18.4L12 3Zm0 6v5m0 3v.1" /></svg>
                </span>
                <div className="mh-ticket-copy">
                  <strong>{issue.issue_type_label}</strong>
                  <span><strong className="mh-ticket-id">Ticket ID : {issue.reference}</strong> · {issue.customer_name} · Order/AWB {issue.order_ref}</span>
                  <p>{issue.description}</p>
                </div>
                <div className="mh-ticket-meta">
                  <span className={`status-pill status-${issue.status}`}>{issue.status_label}</span>
                  <small>{formatDate(issue.created_at)}</small>
                </div>
                <span className="mh-ticket-arrow" aria-hidden="true">→</span>
              </button>
            ))}</div>
          )}
      </Section>

      <Section id="rejected-labels" title="Rejected shipment labels" count={rejectedLabels.length}>
        {rejectedLabels.length === 0 ? <Empty>No rejected shipment labels. There are currently no label problems requiring admin attention.</Empty> : (
          <div className="table-wrap"><table className="mh-table"><thead><tr><th>File</th><th>Order</th><th>AWB</th><th>Courier</th><th>Status</th><th>Verdict</th><th>Uploaded</th></tr></thead><tbody>
            {rejectedLabels.map((row) => <tr key={row.id}><td>{row.file_name}</td><td>{row.order_id || '-'}</td><td>{row.awb ? <Link className="orders-data-link" to={`/dashboard/order-check?order=${encodeURIComponent(row.awb)}`}>{row.awb}</Link> : '-'}</td><td>{row.courier || '-'}</td><td>{pretty(row.status)}</td><td>{row.verdict || row.risk_verdict || '-'}</td><td>{formatDate(row.uploaded_at)}</td></tr>)}
          </tbody></table></div>
        )}
      </Section>

      {selectedIssue ? (
        <Modal title={`Merchant issue ${selectedIssue.reference}`} onClose={() => setSelectedIssue(null)} width={780}>
          <div className="mh-issue-modal">
            <div className="mh-issue-summary">
              <span className={`mh-ticket-icon is-${selectedIssue.status}`} aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M12 3 2.8 20h18.4L12 3Zm0 6v5m0 3v.1" /></svg>
              </span>
              <div>
                <small>Merchant-reported issue</small>
                <strong>{selectedIssue.issue_type_label}</strong>
                <p>{withoutRepeatedOrderIdentifiers(selectedIssue.description)}</p>
              </div>
              <span className={`status-pill status-${selectedIssue.status}`}>{selectedIssue.status_label}</span>
            </div>

            <div className="mh-issue-facts">
              <div><span>Ticket</span><strong>{selectedIssue.reference}</strong></div>
              <div><span>Raised</span><strong>{formatDate(selectedIssue.created_at)}</strong></div>
              <div><span>Last updated</span><strong>{formatDate(selectedIssue.updated_at)}</strong></div>
            </div>

            <div className="mh-issue-orders">
              <h3>Linked orders</h3>
              {selectedIssue.orders.length === 0 ? <Empty>No orders are linked to this issue.</Empty> : selectedIssue.orders.map((order, index) => {
                const reference = order.awb || order.merchant_order_id || order.order_id
                const currentOrder = merchantOrderRows.find((item) => [item.awb, item.merchant_order_id, item.pa_order_id].filter(Boolean).some((value) => String(value).toLowerCase() === String(reference).toLowerCase()))
                const paymentStatus = currentOrder?.payment_state || currentOrder?.order_status || order.payment_state || 'Payment pending'
                const deliveryStatus = currentOrder?.delivery_status || order.delivery_status || 'Not shipped'
                return (
                  <Link key={`${reference}-${index}`} to={`/dashboard/order-check?order=${encodeURIComponent(reference)}`}>
                    <div className="mh-linked-order-ids">
                      <span className="mh-linked-order-id"><strong>Order ID :</strong> {order.merchant_order_id || order.order_id || 'Not available'}</span>
                      <span className="mh-linked-order-id"><strong>AWB :</strong> {order.awb || 'Not available'}</span>
                    </div>
                    <div className="mh-linked-order-statuses">
                      <span className={`mh-order-pill is-${normalizedState(paymentStatus)}`}>{formatPaymentStatus(paymentStatus)}</span>
                      <span className={`mh-order-pill is-${normalizedState(deliveryStatus)}`}>{pretty(deliveryStatus)}</span>
                    </div>
                    <span aria-hidden="true">→</span>
                  </Link>
                )
              })}
            </div>

            <div className="mh-issue-modal-actions">
              <Link className="mh-open-conversation" to={`/dashboard/merchant-issues?q=${encodeURIComponent(selectedIssue.reference)}&chat=${selectedIssue.id}`}>
                Open
              </Link>
            </div>
          </div>
        </Modal>
      ) : null}

      {selectedCustomerIssue ? (
        <Modal title={`Customer issue ${selectedCustomerIssue.reference}`} onClose={() => setSelectedCustomerIssue(null)} width={780}>
          <div className="mh-issue-modal">
            <div className="mh-issue-summary">
              <span className={`mh-ticket-icon is-${selectedCustomerIssue.status}`} aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M12 3 2.8 20h18.4L12 3Zm0 6v5m0 3v.1" /></svg>
              </span>
              <div>
                <small>Customer-reported issue</small>
                <strong>{selectedCustomerIssue.issue_type_label}</strong>
                <p>{customerIssueSummary(selectedCustomerIssue.description)}</p>
              </div>
              <span className={`status-pill status-${selectedCustomerIssue.status}`}>{selectedCustomerIssue.status_label}</span>
            </div>

            <div className="mh-issue-facts">
              <div><span>Ticket</span><strong>{selectedCustomerIssue.reference}</strong></div>
              <div><span>Raised</span><strong>{formatDate(selectedCustomerIssue.created_at)}</strong></div>
              <div><span>Last updated</span><strong>{formatDate(selectedCustomerIssue.updated_at)}</strong></div>
            </div>

            <div className="mh-customer-details">
              <h3>Customer information</h3>
              <div>
                <div><span>Customer</span><strong>{selectedCustomerIssue.customer_name}</strong></div>
                <div><span>Order ID / AWB</span><Link to={`/dashboard/order-check?order=${encodeURIComponent(selectedCustomerIssue.order_ref)}`}>{selectedCustomerIssue.order_ref}</Link></div>
              </div>
            </div>

            <div className="mh-form-details">
              <h3>Information submitted in the form</h3>
              {customerIssueFormDetails(selectedCustomerIssue).length === 0 ? (
                <Empty>No additional form answers were submitted.</Empty>
              ) : (
                <dl>
                  {customerIssueFormDetails(selectedCustomerIssue).map((item) => (
                    <div key={item.key || item.label}>
                      <dt>{item.label}</dt>
                      <dd>{item.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>

            {(selectedCustomerIssue.attachments || []).length > 0 ? (
              <div className="mh-form-attachments">
                <h3>Uploaded evidence</h3>
                <div>{selectedCustomerIssue.attachments.map((attachment) => (
                  <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer">{attachment.name}<span aria-hidden="true">↗</span></a>
                ))}</div>
              </div>
            ) : null}

            {selectedCustomerIssue.customer_email ? (
              <div className="mh-customer-mail-actions">
                <a href={customerIssueMailto(selectedCustomerIssue)} title={`Email ${selectedCustomerIssue.customer_name}`}>
                  Mail to customer
                </a>
              </div>
            ) : null}
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
