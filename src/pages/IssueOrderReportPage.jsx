// Detailed report for one order inside a merchant issue (opened from "View report" in the issue's Orders table).
// Merchant and customer views of the order, plus the order and payment facts and a Print button.
import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import CourierLabel from '../components/CourierLabel'
import OrderDecisionControls from '../components/OrderDecisionControls'
import TicketChatLink from '../components/TicketChatLink'
import { NotesBlock, TagIcon } from '../components/TicketCardParts'

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '-'
}

function formatTime(value) {
  return value ? new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '-'
}

function formatDay(value) {
  return value ? new Date(value).toLocaleDateString() : ''
}

function pretty(value) {
  return String(value || '-')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, (letter) => letter.toUpperCase())
}

function paStatusClass(value) {
  const status = String(value || '').toUpperCase()
  if (['SETTLED', 'RELEASED', 'PAYOUT_COMPLETED'].some((item) => status.includes(item))) return 'status-success'
  if (['FAILED', 'CANCELLED', 'REFUNDED', 'REJECTED'].some((item) => status.includes(item))) return 'status-failed'
  return 'status-pending'
}

function deliveryStatusClass(value) {
  const status = String(value || '').toUpperCase()
  if (status.includes('DELIVERED') && !status.includes('RTO')) return 'status-success'
  if (['FAILED', 'CANCEL', 'RTO', 'DAMAGED', 'LOST', 'UNDELIVERED'].some((item) => status.includes(item))) return 'status-failed'
  return 'status-pending'
}

function formatAmount(amount, currency) {
  const number = Number(amount)
  if (Number.isNaN(number)) return '-'
  return `${currency === 'INR' || !currency ? '₹' : `${currency} `}${number.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function yesNo(value) {
  if (value === true) return 'Yes'
  if (value === false) return 'No'
  return 'Not stated'
}

function Chip({ children, tone = 'blue' }) {
  return <span className={`sr-chip is-${tone}`}>{children}</span>
}

function Rows({ title, rows, columns, empty, hideWhenEmpty = false }) {
  if (hideWhenEmpty && rows.length === 0) return null
  return (
    <div className="sr-block">
      <h4>{title}</h4>
      {rows.length === 0 ? (
        <p className="sr-empty">{empty}</p>
      ) : (
        <div className="sr-table-wrap">
          <table>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.label}>{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  {columns.map((column) => (
                    <td key={column.label}>{column.render(row)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// One order's report: its status tiles, then the merchant and customer tickets side by side. A bulk issue picks the order with the order tabs above.
// Dropdown to choose which order of a bulk issue the report below shows.
function OrderPicker({ orders, value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const close = (event) => {
      if (event.type === 'keydown' ? event.key === 'Escape' : !ref.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  return (
    <div className="ir-picker" ref={ref}>
      <span className="ir-picker-label">Order ID :</span>
      <button type="button" className="ir-picker-btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <strong>{orders[value]}</strong>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open ? (
        <ul className="ir-picker-menu" role="listbox">
          {orders.map((id, index) => (
            <li key={id || index} role="option" aria-selected={index === value}>
              <button type="button" className={index === value ? 'is-active' : ''} onClick={() => { onChange(index); setOpen(false) }}>
                {id}
                {index === value ? <span aria-hidden="true">✓</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function OrderSection({ data }) {
  const c = data.courier
  const customer = data.customer
  const merchant = data.merchant
  // Merchant tickets are ISS-…; every other note (customer tickets, enquiries, messages) belongs to the customer side.
  const merchantNotes = (data.admin_notes || []).filter((item) => /^ISS-/.test(item.source || ''))
  const customerNotes = (data.admin_notes || []).filter((item) => !/^ISS-/.test(item.source || ''))

  return (
        <>
          <div className="oc-tiles is-five">
            <div className="oc-tile oc-courier-tile"><span>Courier</span><strong><CourierLabel courier={c.courier} /></strong></div>
            <div className="oc-tile"><span>PA status</span><strong><span className={`status-pill ${paStatusClass(data.now?.pa_status)}`}>{pretty(data.now?.pa_status || 'NA')}</span></strong></div>
            <div className="oc-tile"><span>Delivery status</span><strong><span className={`status-pill ${deliveryStatusClass(data.order.delivery_status)}`}>{data.order.delivery_status ? pretty(data.order.delivery_status) : 'No shipment'}</span></strong></div>
            <div className="oc-tile"><span>Order amount</span><strong>{formatAmount(data.order.amount, data.order.currency)}</strong></div>
            <div className="oc-tile"><span>Order date</span><strong>{formatDay(data.order.order_date)}</strong></div>
          </div>

          <div className="ir-cards">
            <div className="ir-col-stack">
              <section className="ir-ticket">
                <div className="ir-ticket-head">
                  <h2>Merchant</h2>
                  {data.issue ? <span className={`ir-badge is-${data.issue.status}`}>{data.issue.status_label}</span> : null}
                </div>
                {data.issue ? (
                  <>
                    <p className="ir-ticket-who">{merchant.name} · {data.issue.reference}</p>
                    <p className="ir-ticket-issue"><TagIcon />{data.issue.issue_type_label}</p>
                    {merchant.description ? <p className="ir-ticket-quote">“{merchant.description}”</p> : null}
                    <div className="ir-ticket-foot">
                      <span>{formatTime(data.issue.created_at)} · Merchant message</span>
                      <TicketChatLink reference={data.issue.reference}>Open chat ↓</TicketChatLink>
                    </div>
                  </>
                ) : (
                  <p className="sr-empty">No merchant ticket.</p>
                )}
              </section>
              <NotesBlock title="Merchant internal notes (only admins see these)" notes={merchantNotes} />
            </div>

            <div className="ir-col-stack">
              {(data.customer_issues || []).length === 0 ? (
                <section className="ir-ticket">
                  <div className="ir-ticket-head"><h2>Customer</h2></div>
                  <p className="sr-empty">The customer has not raised a ticket for this order.</p>
                </section>
              ) : null}
              {(data.customer_issues || []).map((ticket) => (
                <section className="ir-ticket" key={ticket.id}>
                  <div className="ir-ticket-head">
                    <h2>Customer</h2>
                    <span className={`ir-badge is-${ticket.status}`}>{ticket.status_label}</span>
                  </div>
                  <p className="ir-ticket-who">{ticket.customer_name || customer.name} · {ticket.reference}</p>
                  <p className="ir-ticket-issue"><TagIcon />{ticket.issue_type_label}</p>
                  {ticket.description ? <p className="ir-ticket-quote">“{ticket.description}”</p> : null}
                  <div className="ir-ticket-foot">
                    <span>{formatTime(ticket.created_at)} · Customer message</span>
                    <TicketChatLink kind="customer" reference={ticket.reference}>Open chat ↓</TicketChatLink>
                  </div>
                </section>
              ))}
              {/* only shown when the customer actually raised an enquiry about this order */}
              {customer.enquiries.length > 0 ? (
              <div className="sr-block">
                <h4>Enquiries about this order</h4>
                {customer.enquiries.map((enquiry) => (
                  <div className="ir-enquiry" key={enquiry.enquiry_id}>
                    <div className="sr-chips">
                      <Chip tone={enquiry.receipt_status === 'received' ? 'green' : 'red'}>{pretty(enquiry.receipt_status)}</Chip>
                      <Chip tone="grey">{pretty(enquiry.status)}</Chip>
                      <Chip tone="grey">{enquiry.enquiry_id}</Chip>
                    </div>
                    <blockquote className="ir-quote">
                      {enquiry.text}
                      <footer>{formatDate(enquiry.created_at)}</footer>
                    </blockquote>
                    <ul className="ir-answers">
                      <li>Someone else received it: <strong>{yesNo(enquiry.someone_else_received)}</strong></li>
                      <li>Courier agent contacted: <strong>{yesNo(enquiry.agent_contacted)}</strong></li>
                      <li>Delivery OTP shared: <strong>{yesNo(enquiry.otp_shared)}</strong></li>
                      <li>Unboxing evidence: <strong>{yesNo(enquiry.unboxing_evidence)}</strong></li>
                    </ul>
                    {enquiry.resolution_status ? (
                      <p className="sr-line">
                        Resolution: <strong>{pretty(enquiry.resolution_status)}</strong>
                        {enquiry.resolution_reason ? ` — ${enquiry.resolution_reason}` : ''}
                      </p>
                    ) : null}
                    {enquiry.notes.map((note, index) => (
                      <blockquote className="ir-quote is-ours" key={index}>
                        {note.note}
                        <footer>{note.by ? `${note.by} · ` : ''}{formatDate(note.created_at)}</footer>
                      </blockquote>
                    ))}
                  </div>
                ))}
              </div>
              ) : null}
              <NotesBlock title="Customer internal notes (only admins see these)" notes={customerNotes} />
            </div>
          </div>

          {data.payment.transitions.length + data.payment.ledger.length > 0 ? (
          <div className="sr-columns">
            <section className="sr-card">
              <Rows
                hideWhenEmpty
                title="Payment state changes"
                empty="No payment changes recorded."
                rows={data.payment.transitions}
                columns={[
                  { label: 'Time', render: (row) => formatDate(row.created_at) },
                  { label: 'From', render: (row) => pretty(row.from_state) },
                  { label: 'To', render: (row) => pretty(row.to_state) },
                  { label: 'Source', render: (row) => row.source },
                ]}
              />
              <Rows
                hideWhenEmpty
                title="Payment ledger"
                empty="No ledger entries."
                rows={data.payment.ledger}
                columns={[
                  { label: 'Time', render: (row) => formatDate(row.created_at) },
                  { label: 'Type', render: (row) => pretty(row.entry_type) },
                  { label: 'Amount', render: (row) => formatAmount(row.amount, row.currency) },
                  { label: 'Reference', render: (row) => row.reference || '-' },
                ]}
              />
            </section>
          </div>
          ) : null}
        </>
  )
}

export default function IssueOrderReportPage() {
  const [orderIndex, setOrderIndex] = useState(0)
  const { issueId } = useParams()
  const [params] = useSearchParams()
  // A bulk issue is one ticket with one report: every order in the issue gets its own tab.
  const orders = params.getAll('order').map((value) => value.trim()).filter(Boolean)
  const key = `${issueId}|${orders.join(',')}`
  const [state, setState] = useState({ key: '', reports: null, error: '' })
  const [decisionActing, setDecisionActing] = useState(false)
  const [decisionMessage, setDecisionMessage] = useState({ type: '', text: '' })

  useEffect(() => {
    let active = true
    // The first order tells us every order in the issue; the rest are then loaded so each gets its own tab.
    const first = orders[0] || ''
    api
      .merchantIssueReport(issueId, first)
      .then(async (head) => {
        const keys = (head.issue?.order_keys || []).filter((value) => value && value !== first)
        const rest = await Promise.all(keys.map((order) => api.merchantIssueReport(issueId, order)))
        return [head, ...rest]
      })
      .then((reports) => active && setState({ key, reports, error: '' }))
      .catch((err) => active && setState({ key, reports: null, error: err.message }))
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    if (!decisionMessage.text) return undefined
    const timer = window.setTimeout(() => setDecisionMessage({ type: '', text: '' }), 4000)
    return () => window.clearTimeout(timer)
  }, [decisionMessage])

  const loading = state.key !== key
  const reports = loading ? null : state.reports
  const issue = reports?.[0]?.issue
  const selected = reports ? reports[Math.min(orderIndex, reports.length - 1)] : null

  async function handleDecision(decision) {
    if (!selected?.pa_control?.vaultpay_order_id || decisionActing) return false
    setDecisionActing(true)
    setDecisionMessage({ type: '', text: '' })
    try {
      const result = await api.paOrderAction(selected.pa_control.vaultpay_order_id, 'send-request', { decision })
      setState((current) => ({
        ...current,
        reports: (current.reports || []).map((report) => (
          report.pa_control?.vaultpay_order_id === result.order.vaultpay_order_id
            ? { ...report, pa_control: result.order }
            : report
        )),
      }))
      setDecisionMessage({ type: 'success', text: `${decision === 'REFUND' ? 'Refund' : 'Release'} decision saved. You have 10 minutes to revoke it before the request is sent.` })
      return true
    } catch (error) {
      setDecisionMessage({ type: 'error', text: error.message || 'The PA request could not be sent.' })
      return false
    } finally {
      setDecisionActing(false)
    }
  }

  async function runDecisionAction(action, successText) {
    if (!selected?.pa_control?.vaultpay_order_id || decisionActing) return false
    setDecisionActing(true)
    setDecisionMessage({ type: '', text: '' })
    try {
      const result = await api.paOrderAction(selected.pa_control.vaultpay_order_id, action, {})
      setState((current) => ({
        ...current,
        reports: (current.reports || []).map((report) => (
          report.pa_control?.vaultpay_order_id === result.order.vaultpay_order_id
            ? { ...report, pa_control: result.order }
            : report
        )),
      }))
      setDecisionMessage({ type: 'success', text: successText })
      return true
    } catch (error) {
      setDecisionMessage({ type: 'error', text: error.message || 'The PA decision could not be updated.' })
      return false
    } finally {
      setDecisionActing(false)
    }
  }

  function handleRevokeDecision() {
    return runDecisionAction('revoke-request', 'Decision revoked. You can now choose refund or release again.')
  }

  function handleFinalizeDecision() {
    return runDecisionAction('finalize-request', 'The 10-minute window ended and the request was sent to PA Control.')
  }

  return (
    <div className="sr-page ir-page">
      <div className="ir-top">
        <h1 className="ir-heading">Order report</h1>
        <div className="ir-top-actions">
          {selected ? <OrderDecisionControls paControl={selected.pa_control} paStatus={selected.now?.pa_status} acting={decisionActing} onDecision={handleDecision} onRevoke={handleRevokeDecision} onFinalize={handleFinalizeDecision} /> : null}
          <button type="button" className="contact-reply-btn" onClick={() => window.print()} disabled={!reports}>Print report</button>
        </div>
      </div>

      {loading ? <p className="sr-empty">Building the report...</p> : null}
      {!loading && state.error ? <div className="error-banner">{state.error}</div> : null}
      {decisionMessage.text ? (
        <div className={`needs-toast needs-toast-${decisionMessage.type === 'success' ? 'success' : 'danger'}`} role="status" aria-live="polite">
          <span>{decisionMessage.text}</span>
          <button type="button" onClick={() => setDecisionMessage({ type: '', text: '' })} aria-label="Dismiss notification">×</button>
        </div>
      ) : null}

      {reports ? (
        <>
          {issue ? <p className="ir-subtitle"><strong>Issue ID :</strong> {issue.reference}</p> : null}

          {reports.length > 1 ? (
            <OrderPicker
              orders={reports.map((item) => item.order.merchant_order_id)}
              value={Math.min(orderIndex, reports.length - 1)}
              onChange={setOrderIndex}
            />
          ) : null}

          <OrderSection key={selected.order.merchant_order_id} data={selected} />
        </>
      ) : null}
    </div>
  )
}
