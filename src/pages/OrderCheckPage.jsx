// Order report for any order, opened from the top-bar search (/dashboard/order-check?order=...). Same layout as the
// merchant issue report: status tiles, then the merchant's tickets on the left and the customer's on the right,
// with the internal notes that only admins see.
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import TicketChatLink from '../components/TicketChatLink'
import { NotesBlock, TagIcon } from '../components/TicketCardParts'

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

const PAID_STATES = ['PAYMENT_CAPTURED', 'CAPTURED', 'FUNDS_HELD', 'HELD', 'PAID']
const PAID_OUT_STATES = ['SETTLED', 'RELEASED', 'PAYOUT_COMPLETED']
const REFUND_STATES = ['REFUNDED', 'REFUND', 'REFUND_COMPLETED']

function paymentLabel(state) {
  const value = String(state || '').toUpperCase()
  if (PAID_STATES.includes(value)) return 'Paid, held safely until delivery'
  if (PAID_OUT_STATES.includes(value)) return 'Paid, released to the merchant'
  if (REFUND_STATES.includes(value)) return 'Refunded to the customer'
  return 'Not paid yet'
}

export default function OrderCheckPage() {
  const [params] = useSearchParams()
  const order = (params.get('order') || '').trim()
  const [state, setState] = useState({ order: '', data: null, error: '' })

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

  const loading = state.order !== order
  const data = loading ? null : state.data
  const report = data?.report
  const c = report?.courier
  const customer = report?.customer
  const issues = data?.issues || []
  const contactMessages = data?.contact_messages || []
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

  return (
    <div className="sr-page ir-page oc-page">
      <div className="ir-top">
        <h1 className="ir-heading">Order report</h1>
        <button type="button" className="contact-reply-btn" onClick={() => window.print()} disabled={!data}>Print report</button>
      </div>

      {loading ? <p className="sr-empty">Checking the order...</p> : null}
      {!loading && state.error ? <div className="error-banner">{state.error}</div> : null}

      {data ? (
        <>
          <p className="ir-subtitle">
            <strong>Order ID :</strong> {data.order.merchant_order_id}
            {data.order.awb ? <> · <strong>AWB :</strong> {data.order.awb}</> : null}
          </p>

          <div className="oc-tiles is-six">
            <div className="oc-tile"><span>Courier</span><strong>{c.courier || 'NA'}</strong></div>
            <div className="oc-tile"><span>Payment status</span><strong>{paymentLabel(data.order.payment_state) === 'Not paid yet' ? 'NA' : paymentLabel(data.order.payment_state)}</strong></div>
            <div className="oc-tile"><span>PA status</span><strong>{data.pa_status || 'NA'}</strong></div>
            <div className="oc-tile"><span>Delivery status</span><strong>{pretty(c.status) || 'No shipment'}</strong></div>
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
                  {issue.description ? <p className="ir-ticket-quote">“{issue.description}”</p> : null}
                  <div className="ir-ticket-foot">
                    <span>{formatTime(issue.created_at)} · Merchant message</span>
                    <TicketChatLink reference={issue.reference}>Open chat ↓</TicketChatLink>
                  </div>
                </section>
              ))}
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
                  {ticket.description ? <p className="ir-ticket-quote">“{ticket.description}”</p> : null}
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
