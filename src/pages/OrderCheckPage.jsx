// Order report for any order, opened from the top-bar search (/dashboard/order-check?order=...). Same layout as the
// merchant issue report: status tiles, then the merchant's tickets on the left and the customer's on the right,
// with the internal notes that only admins see.
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import CourierLabel from '../components/CourierLabel'
import OrderDecisionControls from '../components/OrderDecisionControls'
import TicketChatLink from '../components/TicketChatLink'
import { NotesBlock, TagIcon } from '../components/TicketCardParts'
import { useAuth } from '../context/AuthContext'
import { ROLE_OWNER } from '../utils/roles'

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : ''
}

function formatTime(value) {
  return value ? new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '-'
}

function formatDay(value) {
  return value ? new Date(value).toLocaleDateString() : ''
}

function pretty(value) {
  return value
    ? String(value).replace(/_/g, ' ').toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase()).replace(/\brto\b/i, 'RTO')
    : ''
}

function formatAmount(amount, currency) {
  const number = Number(amount)
  if (amount === null || amount === undefined || amount === '' || Number.isNaN(number)) return ''
  return `${currency === 'INR' || !currency ? '₹' : `${currency} `}${number.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function Quote({ children, by, time, ours }) {
  return (
    <blockquote className={`ir-quote${ours ? ' is-ours' : ''}`}>
      {children}
      <footer>{[by, formatDate(time)].filter(Boolean).join(' · ')}</footer>
    </blockquote>
  )
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

function ConversationHistory({ messages = [], partyLabel }) {
  if (messages.length === 0) return null
  return (
    <div className="ir-conversation-history">
      <h4>Communication history</h4>
      {messages.map((message, index) => {
        const ours = message.sender === 'admin'
        const sender = ours ? (message.by || 'Escrosafe') : partyLabel
        return (
          <Quote key={`${message.created_at || 'message'}-${index}`} by={sender} time={message.created_at} ours={ours}>
            {message.body}
          </Quote>
        )
      })}
    </div>
  )
}

export default function OrderCheckPage() {
  const { admin } = useAuth()
  const [params] = useSearchParams()
  const order = (params.get('order') || '').trim()
  const [state, setState] = useState({ order: '', data: null, error: '' })
  const [decisionActing, setDecisionActing] = useState(false)
  const [decisionMessage, setDecisionMessage] = useState({ type: '', text: '' })
  const [owners, setOwners] = useState([])

  useEffect(() => {
    let active = true
    api
      .orderCheck(order)
      .then((data) => active && setState({ order, data, error: '' }))
      .catch((err) => active && setState({ order, data: null, error: err.message }))
    return () => {
      active = false
    }
  }, [order])

  useEffect(() => {
    if (!decisionMessage.text) return undefined
    const timer = window.setTimeout(() => setDecisionMessage({ type: '', text: '' }), 4000)
    return () => window.clearTimeout(timer)
  }, [decisionMessage])

  const loading = state.order !== order
  const data = loading ? null : state.data
  const report = data?.report
  const requiresOwnerReview = Boolean(data?.pa_control?.owner_review_required && admin?.role !== ROLE_OWNER)
  const c = report?.courier
  const customer = report?.customer
  const issues = data?.issues || []
  const contactMessages = data?.contact_messages || []
  const merchantContactMessages = contactMessages.filter((message) => message.source === 'merchant')
  const customerNotes = (customer?.enquiries || []).flatMap((enquiry) => (enquiry.notes || []).map((note) => ({ ...note, ref: enquiry.enquiry_id })))
  const issueNotes = issues.flatMap((issue) => issue.notes.map((n) => ({ ...n, ref: issue.reference })))
  const customerTickets = data?.customer_issues || []
  const ticketNotes = customerTickets.flatMap((ticket) => ticket.notes.map((n) => ({ ...n, ref: ticket.reference })))
  const contactNotes = contactMessages.filter((m) => m.internal_note)
  const merchantNotes = issueNotes.map((n) => ({ ...n, source: n.ref }))
  const customerSideNotes = [
    ...ticketNotes,
    ...customerNotes,
    ...contactNotes.map((m) => ({ note: m.internal_note, by: '', ref: 'Message', created_at: m.created_at })),
  ].map((n) => ({ ...n, source: n.ref }))

  useEffect(() => {
    if (!requiresOwnerReview) return undefined
    let active = true
    api.ownerReviewers()
      .then((result) => active && setOwners(result.results || []))
      .catch((error) => active && setDecisionMessage({ type: 'error', text: error.message }))
    return () => { active = false }
  }, [requiresOwnerReview])

  async function handleDecision(decision, ownerId) {
    if (!data?.pa_control?.vaultpay_order_id || decisionActing) return false
    setDecisionActing(true)
    setDecisionMessage({ type: '', text: '' })
    try {
      if (requiresOwnerReview) {
        const result = await api.createOwnerDecisionReview({
          vaultpay_order_id: data.pa_control.vaultpay_order_id,
          decision,
          owner_id: ownerId,
        })
        setState((current) => ({
          ...current,
          data: current.data
            ? { ...current.data, pa_control: { ...current.data.pa_control, owner_review: result.review } }
            : current.data,
        }))
        setDecisionMessage({ type: 'success', text: 'Review request sent to the selected owner. The 10-minute window will begin only after approval.' })
        return true
      }
      const result = await api.paOrderAction(data.pa_control.vaultpay_order_id, 'send-request', { decision })
      setState((current) => ({
        ...current,
        data: current.data ? { ...current.data, pa_control: result.order } : current.data,
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

  async function handleRevokeDecision() {
    if (!data?.pa_control?.vaultpay_order_id || decisionActing) return false
    setDecisionActing(true)
    setDecisionMessage({ type: '', text: '' })
    try {
      const result = await api.paOrderAction(data.pa_control.vaultpay_order_id, 'revoke-request', {})
      setState((current) => ({ ...current, data: current.data ? { ...current.data, pa_control: result.order } : current.data }))
      setDecisionMessage({ type: 'success', text: 'Decision revoked. You can now choose refund or release again.' })
      return true
    } catch (error) {
      setDecisionMessage({ type: 'error', text: error.message || 'The decision could not be revoked.' })
      return false
    } finally {
      setDecisionActing(false)
    }
  }

  async function handleFinalizeDecision() {
    if (!data?.pa_control?.vaultpay_order_id || decisionActing) return false
    setDecisionActing(true)
    try {
      const result = await api.paOrderAction(data.pa_control.vaultpay_order_id, 'finalize-request', {})
      setState((current) => ({ ...current, data: current.data ? { ...current.data, pa_control: result.order } : current.data }))
      if (result.order.aggregator_request) setDecisionMessage({ type: 'success', text: 'The 10-minute window ended and the request was sent to PA Control.' })
      return true
    } catch (error) {
      setDecisionMessage({ type: 'error', text: error.message || 'The scheduled request could not be finalized.' })
      return false
    } finally {
      setDecisionActing(false)
    }
  }

  return (
    <div className="sr-page ir-page oc-page">
      <div className="ir-top">
        <h1 className="ir-heading">Order report</h1>
        <div className="ir-top-actions">
          {data ? <OrderDecisionControls paControl={data.pa_control} paStatus={data.pa_status} acting={decisionActing} onDecision={handleDecision} onRevoke={handleRevokeDecision} onFinalize={handleFinalizeDecision} requiresOwnerReview={requiresOwnerReview} owners={owners} /> : null}
          <button type="button" className="contact-reply-btn" onClick={() => window.print()} disabled={!data}>Print report</button>
        </div>
      </div>

      {loading ? <p className="sr-empty">Checking the order...</p> : null}
      {!loading && state.error ? <div className="error-banner">{state.error}</div> : null}
      {decisionMessage.text ? (
        <div className={`needs-toast needs-toast-${decisionMessage.type === 'success' ? 'success' : 'danger'}`} role="status" aria-live="polite">
          <span>{decisionMessage.text}</span>
          <button type="button" onClick={() => setDecisionMessage({ type: '', text: '' })} aria-label="Dismiss notification">×</button>
        </div>
      ) : null}

      {data ? (
        <>
          <p className="ir-subtitle">
            <strong>Order ID :</strong> {data.order.merchant_order_id}
            {data.order.payment_id ? <> · <strong>Payment ID :</strong> {data.order.payment_id}</> : null}
            {data.order.awb ? <> · <strong>AWB :</strong> {data.order.awb}</> : null}
          </p>

          <div className="oc-tiles is-five">
            <div className="oc-tile oc-courier-tile"><span>Courier</span><strong><CourierLabel courier={c.courier} /></strong></div>
            <div className="oc-tile"><span>PA status</span><strong><span className={`status-pill ${paStatusClass(data.pa_status)}`}>{pretty(data.pa_status) || 'NA'}</span></strong></div>
            <div className="oc-tile"><span>Delivery status</span><strong><span className={`status-pill ${deliveryStatusClass(c.status)}`}>{pretty(c.status) || 'No shipment'}</span></strong></div>
            <div className="oc-tile"><span>Order amount</span><strong>{formatAmount(data.order.amount, data.order.currency)}</strong></div>
            <div className="oc-tile"><span>Order date</span><strong>{formatDay(data.order.order_date)}</strong></div>
          </div>

          <div className="ir-cards">
            <div className="ir-col-stack">
              {issues.length === 0 ? (
                <section className="ir-ticket">
                  <div className="ir-ticket-head"><h2>Merchant</h2></div>
                  <p className="ir-ticket-who">{data.merchant.name}</p>
                  <p className="sr-empty">The merchant has not raised a ticket for this order.</p>
                </section>
              ) : null}
              {issues.map((issue) => (
                <section className="ir-ticket" key={issue.id}>
                  <div className="ir-ticket-head">
                    <h2>Merchant</h2>
                    <span className={`ir-badge is-${issue.status}`}>{issue.status_label}</span>
                  </div>
                  <p className="ir-ticket-who">{data.merchant.name} · {issue.reference}</p>
                  <p className="ir-ticket-issue"><TagIcon />{issue.issue_type_label}</p>
                  {issue.messages?.length ? (
                    <ConversationHistory messages={issue.messages} partyLabel={data.merchant.name || 'Merchant'} />
                  ) : issue.description ? <p className="ir-ticket-quote">“{issue.description}”</p> : null}
                  <div className="ir-ticket-foot">
                    <span>{formatTime(issue.created_at)} · Merchant message</span>
                    <TicketChatLink reference={issue.reference}>Open chat ↓</TicketChatLink>
                  </div>
                </section>
              ))}
              {merchantContactMessages.length > 0 ? (
                <section className="ir-ticket">
                  <div className="ir-ticket-head"><h2>Other merchant messages</h2></div>
                  <ConversationHistory
                    messages={merchantContactMessages.map((message) => ({
                      sender: 'merchant',
                      body: message.message,
                      created_at: message.created_at,
                    }))}
                    partyLabel={data.merchant.name || 'Merchant'}
                  />
                </section>
              ) : null}
              <NotesBlock title="Merchant internal notes (only admins see these)" notes={merchantNotes} />
            </div>

            <div className="ir-col-stack">
              {customerTickets.length === 0 ? (
                <section className="ir-ticket">
                  <div className="ir-ticket-head"><h2>Customer</h2></div>
                  <p className="ir-ticket-who">{customer.name}</p>
                  <p className="sr-empty">The customer has not raised a ticket for this order.</p>
                </section>
              ) : null}
              {customerTickets.map((ticket) => (
                <section className="ir-ticket" key={ticket.id}>
                  <div className="ir-ticket-head">
                    <h2>Customer</h2>
                    <span className={`ir-badge is-${ticket.status}`}>{ticket.status_label}</span>
                  </div>
                  <p className="ir-ticket-who">{ticket.customer_name || customer.name} · {ticket.reference}</p>
                  <p className="ir-ticket-issue"><TagIcon />{ticket.issue_type_label}</p>
                  {ticket.messages?.length ? (
                    <ConversationHistory messages={ticket.messages} partyLabel={ticket.customer_name || customer.name || 'Customer'} />
                  ) : ticket.description ? <p className="ir-ticket-quote">“{ticket.description}”</p> : null}
                  <div className="ir-ticket-foot">
                    <span>{formatTime(ticket.created_at)} · Customer message</span>
                    <TicketChatLink kind="customer" reference={ticket.reference}>Open chat ↓</TicketChatLink>
                  </div>
                </section>
              ))}
              {customer.enquiries.length > 0 || contactMessages.some((m) => m.source !== 'merchant') ? (
                <div className="sr-block">
                  <h4>Enquiries and messages about this order</h4>
                  {customer.enquiries.map((enquiry) => (
                    <Quote key={enquiry.enquiry_id} by={`${enquiry.enquiry_id} · ${pretty(enquiry.receipt_status)}`} time={enquiry.created_at}>{enquiry.text}</Quote>
                  ))}
                  {contactMessages.filter((m) => m.source !== 'merchant').map((m, index) => (
                    <Quote key={index} by={`${m.name} · message`} time={m.created_at}>{m.message}</Quote>
                  ))}
                </div>
              ) : null}
              <NotesBlock title="Customer internal notes (only admins see these)" notes={customerSideNotes} />
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
