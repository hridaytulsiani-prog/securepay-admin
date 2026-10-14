// Owner-only inbox for messages sent through the public contact forms. The same page serves two inboxes:
// "customer" (the "Get in touch" form on the customer page) and "merchant" (the "Still have a question?"
// form on the merchant site's landing page). Each message is stored in the database; here the owner can
// read it, search/filter, mark its status and keep an internal note.
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
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
  if (row.source === 'merchant') {
    return row.topic ? `Your EscroSafe question: ${row.topic}` : 'Your EscroSafe question'
  }
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
    <Modal title={`${row.source === 'merchant' ? 'Merchant query from' : 'Message from'} ${row.name}`} onClose={onClose} width={560}>
      <div className="contact-modal">
        <div className="contact-modal-meta">
          <span>{row.email}</span>
          {row.topic && <span>Topic: {row.topic}</span>}
          {row.order_id && <span>{row.source === 'merchant' ? 'Order / AWB' : 'Order'} {row.order_id}</span>}
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

export default function ContactMessagesPage({ source = 'customer' }) {
  const isMerchant = source === 'merchant'
  const [rows, setRows] = useState([])
  const [counts, setCounts] = useState({ new: 0, in_progress: 0, resolved: 0 })
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [limit, setLimit] = useState(25)
  // /dashboard/<page>?q=... opens the page already searched (used by the top-bar search).
  const [searchParams] = useSearchParams()
  const [q, setQ] = useState(searchParams.get('q') || '')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    api
      .contactMessages({ page, limit, q, status: statusFilter, source })
      .then((data) => {
        setRows(data.results || [])
        setCounts(data.counts || { new: 0, in_progress: 0, resolved: 0 })
        setTotalPages(data.total_pages || 1)
        setTotal(data.total || 0)
        setError('')
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [page, limit, q, statusFilter, source])

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

  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1)

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
            {isMerchant ? 'Merchant queries' : 'Customer messages'}
          </div>
        </div>
        <p className="contact-intro">
          {isMerchant
            ? 'Questions sent from the "Still have a question?" form on the merchant site. Open a query to read it, change its status or reply by email.'
            : 'Messages sent from the "Get in touch" form on the customer page. Open a message to read it, change its status or reply by email.'}
        </p>

        <form className="toolbar audit-toolbar" onSubmit={handleSearch}>
          <div className="toolbar-field">
            <label htmlFor="contact-search">Search:</label>
            <input id="contact-search" name="search" placeholder={isMerchant ? 'name, email or message' : 'name, email, order ID or message'} defaultValue={q} />
          </div>
          <div className="toolbar-field">
            <label htmlFor="contact-status">Status:</label>
            <select
              id="contact-status"
              value={statusFilter}
              onChange={(event) => handleStatusFilter(event.target.value)}
            >
              {STATUS_FILTERS.map((item) => (
                <option key={item.value || 'all'} value={item.value}>
                  {item.label}
                </option>
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
          <table className="audit-table">
            <thead>
              <tr>
                <th>Received</th>
                <th>From</th>
                {!isMerchant && <th>Order ID</th>}
                <th>Message</th>
                <th>Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isMerchant ? 5 : 6} className="empty-row">Loading...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={isMerchant ? 5 : 6} className="empty-row">{isMerchant ? 'No merchant queries yet.' : 'No messages found.'}</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className={row.status === 'new' ? 'contact-row-new' : ''}>
                    <td><span className="cell-muted">{formatDate(row.created_at)}</span></td>
                    <td>
                      <div className="cell-strong">{row.name}</div>
                      <div className="cell-muted">{row.email}</div>
                    </td>
                    {!isMerchant && <td><span className="cell-strong">{row.order_id || '-'}</span></td>}
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
      {selectedRow && <MessageModal row={selectedRow} onClose={() => setSelectedId(null)} onChanged={load} />}
    </div>
  )
}
