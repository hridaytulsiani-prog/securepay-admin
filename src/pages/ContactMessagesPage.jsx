// Owner-only inbox for messages sent through the public "Get in touch" form on
// the customer page. Each message is stored in the database; here the owner can
// read it, search/filter, mark its status and keep an internal note.
import { useCallback, useEffect, useState } from 'react'
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

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '-'
}

function defaultReplySubject(row) {
  return row.order_id ? `Your EscroSafe query about order ${row.order_id}` : 'Your EscroSafe query'
}

// Opens the admin's own mail app with the customer's address, a subject and a
// short greeting already filled in. The mail goes out from whichever account
// is set up in that app (use the EscroSafe support account there).
function buildReplyLink(row) {
  const body = `Hi ${row.name},



---
Your message:
${row.message}`
  return `mailto:${row.email}?subject=${encodeURIComponent(defaultReplySubject(row))}&body=${encodeURIComponent(body)}`
}

// Popup with the full message, a status dropdown and the reply button.
function MessageModal({ row, onClose, onChanged }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Changing the status saves right away; no separate Save button.
  async function handleStatusChange(event) {
    setSaving(true)
    setError('')
    try {
      await api.updateContactMessage(row.id, { status: event.target.value })
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`Message from ${row.name}`} onClose={onClose} width={560}>
      <div className="contact-modal">
        <div className="contact-modal-meta">
          <span>{row.email}</span>
          {row.order_id && <span>Order {row.order_id}</span>}
          <span>{formatDate(row.created_at)}</span>
        </div>

        <label className="contact-modal-status">
          <span className="contact-detail-label">Status</span>
          <select value={row.status} onChange={handleStatusChange} disabled={saving}>
            <option value="new">New</option>
            <option value="in_progress">In progress</option>
            <option value="resolved">Resolved</option>
          </select>
        </label>

        <div>
          <span className="contact-detail-label">Message</span>
          <p className="contact-modal-text">{row.message}</p>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <div className="contact-reply-actions">
          <a className="contact-reply-btn" href={buildReplyLink(row)}>
            Reply by email
          </a>
        </div>
      </div>
    </Modal>
  )
}

export default function ContactMessagesPage() {
  const [rows, setRows] = useState([])
  const [counts, setCounts] = useState({ new: 0, in_progress: 0, resolved: 0 })
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [limit, setLimit] = useState(25)
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    api
      .contactMessages({ page, limit, q, status: statusFilter })
      .then((data) => {
        setRows(data.results || [])
        setCounts(data.counts || { new: 0, in_progress: 0, resolved: 0 })
        setTotalPages(data.total_pages || 1)
        setTotal(data.total || 0)
        setError('')
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [page, limit, q, statusFilter])

  useEffect(() => {
    load()
  }, [load])

  function handleSearch(event) {
    event.preventDefault()
    setPage(1)
    setQ(event.target.elements.search.value)
  }

  function handleStatusFilter(value) {
    setPage(1)
    setStatusFilter(value)
  }

  const selectedRow = rows.find((row) => row.id === selectedId) || null

  const allCount = counts.new + counts.in_progress + counts.resolved

  return (
    <div className="audit-page">
      <div className="panel-card audit-surface">
        <div className="section-title audit-section-title">
          <div className="section-title-left">
            <span className="orders-section-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4 3.5V17h-.5A2.5 2.5 0 0 1 4 14.5v-8Zm4 1.5a1 1 0 0 0 0 2h8a1 1 0 1 0 0-2H8Zm0 3.5a1 1 0 1 0 0 2h5a1 1 0 1 0 0-2H8Z" />
              </svg>
            </span>
            Customer messages
          </div>
        </div>
        <p className="contact-intro">
          Messages sent from the &quot;Get in touch&quot; form on the customer page. Open a message to read it, change its status or reply by email.
        </p>

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
                onClick={() => handleStatusFilter(item.value)}
              >
                {item.label} <span>{count}</span>
              </button>
            )
          })}
        </div>

        <form className="toolbar audit-toolbar" onSubmit={handleSearch}>
          <div className="toolbar-field">
            <label htmlFor="contact-search">Search:</label>
            <input id="contact-search" name="search" placeholder="name, email, order ID or message" defaultValue={q} />
          </div>
          <div className="toolbar-field">
            <label htmlFor="contact-rows">Rows:</label>
            <select
              id="contact-rows"
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
          <button type="button" onClick={load}>
            Refresh
          </button>
        </form>

        {error && <div className="error-banner">{error}</div>}

        <div className="table-wrap audit-table-wrap">
          <table className="audit-table">
            <thead>
              <tr>
                <th>Received</th>
                <th>From</th>
                <th>Order ID</th>
                <th>Message</th>
                <th>Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="empty-row">Loading...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-row">No messages found.</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className={row.status === 'new' ? 'contact-row-new' : ''}>
                    <td><span className="cell-muted">{formatDate(row.created_at)}</span></td>
                    <td>
                      <div className="cell-strong">{row.name}</div>
                      <div className="cell-muted">{row.email}</div>
                    </td>
                    <td><span className="cell-strong">{row.order_id || '-'}</span></td>
                    <td><div className="cell-message contact-preview">{row.message}</div></td>
                    <td><span className={`status-pill ${STATUS_PILL_CLASS[row.status] || ''}`}>{row.status_label}</span></td>
                    <td>
                      <button type="button" className="table-action-link" onClick={() => setSelectedId(row.id)}>
                        Open
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="pagination audit-pagination">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Prev
          </button>
          <span>
            Page {page} of {totalPages} ({total} {total === 1 ? 'message' : 'messages'})
          </span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      </div>
      {selectedRow && <MessageModal row={selectedRow} onClose={() => setSelectedId(null)} onChanged={load} />}
    </div>
  )
}
