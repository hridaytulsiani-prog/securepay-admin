// Customer issues: tickets about an order raised on behalf of a customer (order not received, wrong item, ...).
// It works like the Merchant issues page: a table, a chat window per ticket, a status and internal notes.
// Customers raise tickets from the /report-issue page.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { API_BASE_URL, api } from '../api/client'
import Modal from '../components/Modal'

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
]

const STATUS_PILL_CLASS = { new: 'status-created', in_progress: 'status-pending', resolved: 'status-resolved' }

// Keep in sync with CustomerIssue.ISSUE_TYPE_CHOICES in SecurePay/adminpanel/models.py.
const ISSUE_TYPES = [
  { value: 'not_received', label: 'Order marked delivered but not received' },
  { value: 'wrong_item', label: 'Received a wrong item' },
  { value: 'damaged', label: 'Received a damaged item' },
  { value: 'delayed', label: 'Order is delayed' },
  { value: 'refund', label: 'Refund problem' },
  { value: 'other', label: 'Something else' },
]

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '-'
}

function timeLabel(value) {
  return value ? new Date(value).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : ''
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

function pretty(value) {
  return String(value || '').replace(/_/g, ' ').toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase())
}

function PersonAvatar() {
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

// Everything the customer told us on the form: contact, order, their answers, the description and any photos.
function DetailRow({ label, children }) {
  if (!children) return null
  return (
    <div className="sr-field">
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  )
}

export function IssueDetailsBody({ row }) {
  const order = row.order || {}
  const photos = row.attachments || []
  return (
    <div className="cis-details">
      <div className="cis-details-grid">
        <DetailRow label="Customer">{row.customer_name}</DetailRow>
        <DetailRow label="Phone">{row.customer_phone}</DetailRow>
        <DetailRow label="Email">{row.customer_email}</DetailRow>
        <DetailRow label="Raised">{formatDate(row.created_at)}</DetailRow>
        <DetailRow label="Problem">{row.issue_type_label}</DetailRow>
        <DetailRow label="Status">{row.status_label}</DetailRow>
        <DetailRow label="Order ID / AWB typed">{row.order_ref}</DetailRow>
        <DetailRow label="Merchant">{order.merchant_name}</DetailRow>
        <DetailRow label="Courier">{order.courier}</DetailRow>
        <DetailRow label="Delivery status">{order.delivery_status ? pretty(order.delivery_status) : ''}</DetailRow>
      </div>
      {order.merchant_order_id ? null : <p className="cis-note">No order matched what the customer typed.</p>}

      {(row.details || []).length > 0 ? (
        <div className="sr-block">
          <h4>Their answers</h4>
          <dl className="cis-answers">
            {row.details.map((item) => (
              <div key={item.key}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}


      <div className="sr-block">
        <h4>Photos ({photos.length})</h4>
        {photos.length === 0 ? (
          <p className="sr-empty">No photos were attached.</p>
        ) : (
          <ul className="cis-photos">
            {photos.map((photo) => (
              <li key={photo.id}>
                <a href={`${API_BASE_URL}${photo.url}`} target="_blank" rel="noreferrer" title="Open the full photo">
                  <img src={`${API_BASE_URL}${photo.url}`} alt={photo.name || 'Customer photo'} />
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export function DetailsModal({ row, onClose }) {
  return (
    <Modal title={`${row.reference} · ${row.issue_type_label}`} onClose={onClose} width={760}>
      <IssueDetailsBody row={row} />
    </Modal>
  )
}

// Chat with the customer: the customer on the left, EscroSafe on the right, status and internal notes like the merchant chat.
export function ChatModal({ row, onClose, onChanged }) {
  const [draft, setDraft] = useState('')
  const [note, setNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [sending, setSending] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)
  const [error, setError] = useState('')
  const chatEndRef = useRef(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: 'end' })
  }, [row.messages.length])

  async function handleStatusChange(event) {
    setSavingStatus(true)
    setError('')
    try {
      await api.updateCustomerIssue(row.id, { status: event.target.value })
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
      await api.addCustomerIssueNote(row.id, { note: text })
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
      await api.sendCustomerIssueMessage(row.id, { body })
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
        <details className="issue-note-box cis-chat-details">
          <summary>Full details{(row.attachments || []).length ? ` · ${row.attachments.length} photo${row.attachments.length === 1 ? '' : 's'}` : ''}</summary>
          <IssueDetailsBody row={row} />
        </details>

        <div className="issue-chat-top">
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
                  {fromAdmin ? null : <PersonAvatar />}
                  <div className="issue-chat-bubble">
                    <span className="issue-chat-who">{fromAdmin ? `You${message.admin_name ? ` (${message.admin_name})` : ''}` : row.customer_name}</span>
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
            placeholder="Type a reply to the customer"
            aria-label="Message"
          />
          <button type="submit" className="issue-chat-send" aria-label="Send" title="Send" disabled={sending || !draft.trim()}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12 20 4l-4.5 16-3.5-6.5L4 12Zm8 1.5 3.5-4.5" /></svg>
          </button>
        </form>

        <details className="issue-note-box" open={row.notes.length > 0 || undefined}>
          <summary>Internal notes ({row.notes.length}) · only admins see these, never the customer</summary>
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

export default function CustomerIssuesPage() {
  const [rows, setRows] = useState([])
  const [counts, setCounts] = useState({ new: 0, in_progress: 0, resolved: 0 })
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [limit, setLimit] = useState(25)
  const [searchParams] = useSearchParams()
  const [q, setQ] = useState(searchParams.get('q') || '')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [chatId, setChatId] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    api
      .customerIssues({ page, limit, q, status: statusFilter, type: typeFilter })
      .then((data) => {
        setRows(data.results || [])
        setCounts(data.counts || { new: 0, in_progress: 0, resolved: 0 })
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
  const allCount = counts.new + counts.in_progress + counts.resolved

  return (
    <div className="audit-page">
      <div className="panel-card audit-surface">
        <div className="section-title audit-section-title">
          <div className="section-title-left">
            <span className="orders-section-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="8.5" r="3.6" />
                <path d="M4.5 20c.5-4 3.5-6.2 7.5-6.2s7 2.2 7.5 6.2" />
              </svg>
            </span>
            Customer issues
          </div>
        </div>
        <p className="contact-intro">Problems customers report about their orders. Open a ticket to chat, set its status and keep internal notes.</p>

        <div className="contact-filter-chips" role="tablist" aria-label="Filter by status">
          {STATUS_FILTERS.map((item) => {
            const count = item.value ? counts[item.value] : allCount
            return (
              <button
                key={item.value || 'all'}
                type="button"
                role="tab"
                aria-selected={statusFilter === item.value}
                className={`contact-chip${statusFilter === item.value ? ' is-active' : ''}`}
                onClick={() => {
                  setPage(1)
                  setStatusFilter(item.value)
                }}
              >
                {item.label} <span>{count}</span>
              </button>
            )
          })}
        </div>

        <form className="toolbar audit-toolbar" onSubmit={handleSearch}>
          <div className="toolbar-field">
            <label htmlFor="cis-search">Search:</label>
            <input id="cis-search" name="search" placeholder="CIS-00012, customer, order ID or text" defaultValue={q} />
          </div>
          <div className="toolbar-field">
            <label htmlFor="cis-type">Issue:</label>
            <select
              id="cis-type"
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
          <div className="toolbar-field">
            <label htmlFor="cis-rows">Rows:</label>
            <select
              id="cis-rows"
              value={limit}
              onChange={(event) => {
                setLimit(Number(event.target.value))
                setPage(1)
              }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          <button type="submit">Search</button>
          <button type="button" onClick={load}>Refresh</button>
        </form>

        {error && <div className="error-banner">{error}</div>}

        <div className="table-wrap audit-table-wrap">
          <table className="audit-table issue-table">
            <thead>
              <tr>
                <th>Ticket number</th>
                <th>Received</th>
                <th>Customer</th>
                <th>Order</th>
                <th>Type</th>
                <th>Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={7} className="empty-row">Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="empty-row">No customer issues yet.</td></tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className={row.awaiting_reply && row.status !== 'resolved' ? 'contact-row-new' : ''}>
                    <td><span className="cell-strong">{row.reference}</span></td>
                    <td><span className="cell-muted">{formatDate(row.created_at)}</span></td>
                    <td>
                      <div className="cell-strong">{row.customer_name}</div>
                      <div className="cell-muted">{row.customer_phone || row.customer_email || ''}</div>
                    </td>
                    <td>
                      <div className="cell-strong">{row.order_ref}</div>
                      <div className="cell-muted">
                        {row.order?.merchant_order_id
                          ? `${row.order.merchant_name || 'Order found'}${row.order.delivery_status ? ` · ${pretty(row.order.delivery_status)}` : ''}`
                          : 'Order not found'}
                      </div>
                    </td>
                    <td>
                      <span className="issue-type-cell">{row.issue_type_label}</span>
                      {(row.attachments || []).length > 0 ? (
                        <div className="cell-muted">{row.attachments.length} photo{row.attachments.length === 1 ? '' : 's'} attached</div>
                      ) : null}
                    </td>
                    <td>
                      <span className={`status-pill ${STATUS_PILL_CLASS[row.status] || ''}`}>{row.status_label}</span>
                      {row.awaiting_reply && row.status !== 'resolved' ? <div className="cell-muted issue-awaiting">Needs a reply</div> : null}
                    </td>
                    <td>
                      <button type="button" className="table-action-link" onClick={() => setChatId(row.id)}>Open</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="pagination audit-pagination">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
          <span>
            Page {page} of {totalPages} ({total} {total === 1 ? 'issue' : 'issues'})
          </span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      </div>
      {chatRow && <ChatModal key={chatRow.id} row={chatRow} onClose={() => setChatId(null)} onChanged={load} />}
    </div>
  )
}
