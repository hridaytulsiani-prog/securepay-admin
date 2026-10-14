// Owner-only inbox for issues merchants raise from their dashboard (an order delivered but shown differently,
// a delayed payment, a refund problem, ...). The table mirrors the merchant's Support page: "Orders > Open" shows
// the orders in the issue, "Details > Open" opens a WhatsApp-style chat with the merchant. The status moves to
// "In progress" by itself on the first reply, and the admin can set it by hand (for example to Resolved) in the chat.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import Modal from '../components/Modal'

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
]

const STATUS_PILL_CLASS = {
  new: 'status-created',
  in_progress: 'status-pending',
  resolved: 'status-resolved',
}

// Keep in sync with MerchantIssue.ISSUE_TYPE_CHOICES in SecurePay/adminpanel/models.py.
const ISSUE_TYPES = [
  { value: 'status_mismatch', label: 'Delivered, but a different status is shown' },
  { value: 'payment_delayed', label: 'Delivered, but payment is delayed' },
  { value: 'payment_missing', label: 'Payment not received or wrong amount' },
  { value: 'tracking_stuck', label: 'Tracking is not updating' },
  { value: 'rto_return', label: 'Return or RTO not reflected' },
  { value: 'customer_dispute', label: 'Customer says the order was not delivered' },
  { value: 'other', label: 'Something else' },
]

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '-'
}

function formatAmount(value) {
  const amount = Number(value)
  if (!value || Number.isNaN(amount)) return '-'
  return `₹ ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function prettyStatus(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, (letter) => letter.toUpperCase())
}

function dayKey(value) {
  const parsed = value ? new Date(value) : null
  return parsed && !Number.isNaN(parsed.getTime()) ? `${parsed.getFullYear()}-${parsed.getMonth()}-${parsed.getDate()}` : ''
}

function dayLabel(value) {
  const parsed = new Date(value)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (dayKey(parsed) === dayKey(today)) return 'Today'
  if (dayKey(parsed) === dayKey(yesterday)) return 'Yesterday'
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function timeLabel(value) {
  return value ? new Date(value).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : ''
}

// Pop-up with every order attached to an issue: order ID, AWB, courier, amount, payment and delivery status.
function OrdersModal({ row, onClose }) {
  return (
    <Modal title={`Orders in ${row.reference}`} onClose={onClose} width={940}>
      <div className="issue-orders-wrap">
        <table className="audit-table issue-orders-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>AWB number</th>
              <th>Courier</th>
              <th>Amount</th>
              <th>Payment</th>
              <th>Status</th>
              <th>Report</th>
            </tr>
          </thead>
          <tbody>
            {row.orders.map((order, index) => (
              <tr key={`${order.merchant_order_id}-${order.awb}`}>
                <td><span className="cell-strong">{order.merchant_order_id || order.order_id}</span></td>
                <td><span className="cell-muted">{order.awb || '-'}</span></td>
                <td>{order.courier || '-'}</td>
                <td>{formatAmount(order.amount)}</td>
                <td>{order.payment_state ? prettyStatus(order.payment_state) : '-'}</td>
                <td>{order.delivery_status ? <span className="issue-order-status">{prettyStatus(order.delivery_status)}</span> : '-'}</td>
                {/* a bulk issue is one ticket, so it gets one report: a single cell spanning every order row */}
                {index === 0 ? (
                  <td rowSpan={row.orders.length}>
                    <Link
                      className="issue-report-link"
                      to={`/dashboard/merchant-issues/${row.id}/report?${row.orders.map((item) => `order=${encodeURIComponent(item.awb || item.merchant_order_id || item.order_id)}`).join('&')}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View report
                    </Link>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  )
}

function MerchantAvatar() {
  return (
    <span className="issue-avatar is-merchant" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="8.5" r="3.6" />
        <path d="M4.5 20c.5-4 3.5-6.2 7.5-6.2s7 2.2 7.5 6.2" />
      </svg>
    </span>
  )
}

function EscroSafeAvatar() {
  return (
    <span className="issue-avatar is-escrosafe" aria-hidden="true">
      <img src="/short-logo-new.png" alt="" />
    </span>
  )
}

function MerchantIssueDetails({ row }) {
  return (
    <div className="cis-details">
      <div className="cis-details-grid">
        <div className="sr-field">
          <span>Merchant</span>
          <strong>{row.merchant_name || '-'}</strong>
        </div>
        <div className="sr-field">
          <span>Email</span>
          <strong>{row.merchant_email || '-'}</strong>
        </div>
        <div className="sr-field">
          <span>Ticket</span>
          <strong>{row.reference || '-'}</strong>
        </div>
        <div className="sr-field">
          <span>Raised</span>
          <strong>{formatDate(row.created_at)}</strong>
        </div>
        <div className="sr-field">
          <span>Issue</span>
          <strong>{row.issue_type_label || '-'}</strong>
        </div>
        <div className="sr-field">
          <span>Orders</span>
          <strong>{(row.orders || []).length || '-'}</strong>
        </div>
      </div>
    </div>
  )
}

// Chat with the merchant, laid out like WhatsApp from the admin's side: the merchant's messages on the left, the
// admin's (EscroSafe) replies on the right.
export function ChatModal({ row, onClose, onChanged }) {
  const [draft, setDraft] = useState('')
  const [note, setNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [sending, setSending] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)
  const [error, setError] = useState('')
  const chatEndRef = useRef(null)

  // Keep the newest message in view, and pick up the merchant's new messages while the pop-up is open.
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: 'end' })
  }, [row.messages.length])
  useEffect(() => {
    const timer = window.setInterval(onChanged, 15000)
    return () => window.clearInterval(timer)
  }, [onChanged])

  async function handleStatusChange(event) {
    setSavingStatus(true)
    setError('')
    try {
      await api.updateMerchantIssue(row.id, { status: event.target.value })
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingStatus(false)
    }
  }

  async function handleAddNote() {
    const text = note.trim()
    if (!text || savingNote) return
    setSavingNote(true)
    setError('')
    try {
      await api.addMerchantIssueNote(row.id, { note: text })
      setNote('')
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingNote(false)
    }
  }

  async function handleSend(event) {
    event.preventDefault()
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    setError('')
    try {
      await api.sendMerchantIssueMessage(row.id, { body })
      setDraft('')
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal
      title={
        <span className="issue-modal-title">
          <img src="/short-logo-new.png" alt="" />
          <span className="issue-modal-title-text">
            <span className="issue-modal-ref">{row.reference}</span>
            <span className="issue-modal-type">{row.issue_type_label}</span>
          </span>
        </span>
      }
      onClose={onClose}
      width={760}
    >
      <div className="issue-chat-modal">
        <div className="issue-chat-top cis-chat-top">
          <details className="issue-note-box cis-chat-details">
            <summary>Details</summary>
            <MerchantIssueDetails row={row} />
          </details>
          <label className="issue-status-control">
            <span>Status</span>
            <select value={row.status} onChange={handleStatusChange} disabled={savingStatus}>
              <option value="new">New</option>
              <option value="in_progress">In progress</option>
              <option value="resolved">Resolved</option>
            </select>
          </label>
        </div>

        <div className="issue-chat-body" aria-live="polite">
          {row.messages.map((message, index) => {
            const fromAdmin = message.sender === 'admin'
            const startsNewDay = index === 0 || dayKey(message.created_at) !== dayKey(row.messages[index - 1].created_at)
            return (
              <div key={message.id} className="issue-chat-item">
                {startsNewDay ? <div className="issue-chat-day"><span>{dayLabel(message.created_at)}</span></div> : null}
                <div className={`issue-chat-row ${fromAdmin ? 'is-admin' : 'is-merchant'}`}>
                  {fromAdmin ? null : <MerchantAvatar />}
                  <div className="issue-chat-bubble">
                    <span className="issue-chat-who">{fromAdmin ? `You${message.admin_name ? ` (${message.admin_name})` : ''}` : row.merchant_name}</span>
                    <p>{message.body}</p>
                    <time>{timeLabel(message.created_at)}</time>
                  </div>
                  {fromAdmin ? <EscroSafeAvatar /> : null}
                </div>
              </div>
            )
          })}
          <div ref={chatEndRef} />
        </div>

        {error && <div className="error-banner">{error}</div>}

        <form className="issue-chat-form" onSubmit={handleSend}>
          <textarea
            rows={1}
            maxLength={2000}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) handleSend(event)
            }}
            placeholder="Type a reply to the merchant"
            aria-label="Reply to the merchant"
          />
          <button type="submit" className="issue-chat-send" aria-label="Send reply" title="Send" disabled={sending || !draft.trim()}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12 20 4l-4.5 16-3.5-6.5L4 12Zm8 1.5 3.5-4.5" /></svg>
          </button>
        </form>

        <details className="issue-note-box" open={row.notes.length > 0 || undefined}>
          <summary>Internal notes ({row.notes.length}) · only admins see these, never the merchant</summary>
          {row.notes.length > 0 ? (
            <ul className="issue-note-list">
              {row.notes.map((entry) => (
                <li key={entry.id}>
                  <p>{entry.note}</p>
                  <span>{entry.admin_name || 'Admin'} · {formatDate(entry.created_at)}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <textarea rows={3} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a note for the team" />
          <div className="issue-note-actions">
            <button type="button" className="contact-reply-btn" onClick={handleAddNote} disabled={savingNote || !note.trim()}>
              {savingNote ? 'Saving...' : 'Add note'}
            </button>
          </div>
        </details>

      </div>
    </Modal>
  )
}

export default function MerchantIssuesPage() {
  const [rows, setRows] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 25
  // /dashboard/merchant-issues?q=ISS-00012 opens the list already searched (used by the top-bar search).
  const [searchParams] = useSearchParams()
  const [q, setQ] = useState(searchParams.get('q') || '')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [chatId, setChatId] = useState(Number(searchParams.get('chat')) || null)
  const [ordersId, setOrdersId] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    api
      .merchantIssues({ page, limit, q, status: statusFilter, type: typeFilter })
      .then((data) => {
        setRows(data.results || [])
        setTotalPages(data.total_pages || 1)
        setTotal(data.total || 0)
        setError('')
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [page, limit, q, statusFilter, typeFilter])

  useEffect(() => {
    load()
  }, [load])

  function handleSearch(event) {
    event.preventDefault()
    setPage(1)
    setQ(event.target.elements.search.value)
  }

  const chatRow = rows.find((row) => row.id === chatId) || null
  const ordersRow = rows.find((row) => row.id === ordersId) || null
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1)

  return (
    <div className="audit-page">
      <div className="panel-card audit-surface">
        <div className="section-title audit-section-title">
          <div className="section-title-left">
            <span className="orders-section-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M12 2 2 21h20L12 2Zm1 14h-2v-2h2v2Zm0-4h-2V8h2v4Z" />
              </svg>
            </span>
            Merchant issues
          </div>
        </div>
        <p className="contact-intro">
          Issues merchants raise from their dashboard about specific orders. Open the orders to see them, or open the details to chat with the merchant and set the status.
        </p>

        <form className="toolbar audit-toolbar" onSubmit={handleSearch}>
          <div className="toolbar-field">
            <label htmlFor="issue-search">Search:</label>
            <input id="issue-search" name="search" placeholder="ISS-00012, merchant, order ID or text" defaultValue={q} />
          </div>
          <div className="toolbar-field">
            <label htmlFor="issue-status">Status:</label>
            <select
              id="issue-status"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value)
                setPage(1)
              }}
            >
              {STATUS_FILTERS.map((status) => (
                <option key={status.value || 'all'} value={status.value}>{status.label}</option>
              ))}
            </select>
          </div>
          <div className="toolbar-field">
            <label htmlFor="issue-type">Issue:</label>
            <select
              id="issue-type"
              value={typeFilter}
              onChange={(event) => {
                setTypeFilter(event.target.value)
                setPage(1)
              }}
            >
              <option value="">All issue types</option>
              {ISSUE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
          <button type="submit">Search</button>
          <button type="button" onClick={load}>
            Refresh
          </button>
        </form>

        {error && <div className="error-banner">{error}</div>}

        <div className="table-wrap audit-table-wrap">
          <table className="audit-table issue-table">
            <thead>
              <tr>
                <th>Ticket number</th>
                <th>Received</th>
                <th>Merchant</th>
                <th>Type</th>
                <th>Orders</th>
                <th>Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-row">Loading...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-row">No merchant issues yet.</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className={row.awaiting_reply && row.status !== 'resolved' ? 'contact-row-new' : ''}>
                    <td><span className="cell-strong">{row.reference}</span></td>
                    <td><span className="cell-muted">{formatDate(row.created_at)}</span></td>
                    <td>
                      <div className="cell-strong">{row.merchant_name}</div>
                      <div className="cell-muted">{row.merchant_email}</div>
                    </td>
                    <td><span className="issue-type-cell">{row.issue_type_label}</span></td>
                    <td>
                      <button type="button" className="table-action-link" onClick={() => setOrdersId(row.id)}>
                        Open
                      </button>
                    </td>
                    <td>
                      <span className={`status-pill ${STATUS_PILL_CLASS[row.status] || ''}`}>{row.status_label}</span>
                    </td>
                    <td>
                      <button type="button" className="table-action-link" onClick={() => setChatId(row.id)}>
                        Open
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="contact-pagination">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Prev
          </button>
          {pageNumbers.map((pageNumber) => (
            <button
              key={pageNumber}
              type="button"
              className={pageNumber === page ? 'is-active' : ''}
              onClick={() => setPage(pageNumber)}
            >
              {pageNumber}
            </button>
          ))}
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      </div>
      {ordersRow && <OrdersModal row={ordersRow} onClose={() => setOrdersId(null)} />}
      {chatRow && <ChatModal key={chatRow.id} row={chatRow} onClose={() => setChatId(null)} onChanged={load} />}
    </div>
  )
}
