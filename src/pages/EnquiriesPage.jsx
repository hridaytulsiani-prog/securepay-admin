// Cross-merchant enquiry list — data comes from
// adminpanel.api.v1.orders_views.AdminEnquiryListView. This is the page
// admins use to investigate a customer complaint and decide who gets the
// money: NotesModal for the running investigation log, ResolutionModal for
// the final refund/pay-merchant decision + reason.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import DecisionHistoryModal from '../components/DecisionHistoryModal'
import Modal from '../components/Modal'
import NotesModal from '../components/NotesModal'
import ResolutionModal from '../components/ResolutionModal'
import { useAuth } from '../context/AuthContext'
import { useColumnVisibility } from '../hooks/useColumnVisibility'
import { hasPermission } from '../utils/roles'

function truncate(text, max = 80) {
  if (!text) return '—'
  return text.length > max ? `${text.slice(0, max)}…` : text
}

const RESOLUTION_LABELS = {
  unresolved: 'Unresolved',
  money_refunded: 'Money Refunded',
  money_to_merchant: 'Money To Merchant',
}

function formatLabel(value) {
  const text = String(value || '').replace(/[_-]+/g, ' ').trim()
  return text ? text.toUpperCase() : '—'
}

// Notes, Details and Action are rendered separately from the picker's list below.
const COLUMNS = [
  { key: 'enquiry_id', label: 'Enquiry ID', className: 'enquiry-col-id', render: (row) => <span className="cell-strong">{row.enquiry_id}</span> },
  { key: 'order_id', label: 'Order ID', className: 'enquiry-col-order', render: (row) => row.order_id },
  {
    key: 'merchant',
    label: 'Merchant',
    className: 'enquiry-col-merchant',
    render: (row) => (
      <>
        <div className="cell-strong">{row.merchant_name || '—'}</div>
        <div className="cell-muted">{row.merchant_email || ''}</div>
      </>
    ),
  },
  { key: 'awb', label: 'AWB', className: 'enquiry-col-shipment', render: (row) => row.shipment_awb || '—' },
  {
    key: 'customer',
    label: 'Customer',
    className: 'enquiry-col-customer',
    render: (row) => (
      <>
        <div className="cell-strong">{row.customer_name || '—'}</div>
        <div className="cell-muted">{row.customer_phone}</div>
      </>
    ),
  },
  {
    key: 'receipt_status',
    label: 'Receipt Status',
    className: 'enquiry-col-receipt',
    render: (row) => (
      <span className={`status-pill status-${(row.receipt_status || '').toLowerCase()}`}>{formatLabel(row.receipt_status)}</span>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    className: 'enquiry-col-status',
    render: (row) => <span className={`status-pill status-${(row.status || '').toLowerCase()}`}>{formatLabel(row.status)}</span>,
  },
  {
    key: 'submitted',
    label: 'Submitted',
    className: 'enquiry-col-submitted',
    render: (row) => (
      <span className="cell-muted">{row.created_at ? new Date(row.created_at).toLocaleString() : '—'}</span>
    ),
  },
]

// Read-only popup with everything about one enquiry, including the full message.
// No reply-by-email here: the admin works through the notes/resolution flow instead.
function EnquiryDetailsModal({ row, onClose }) {
  const details = [
    ['Enquiry ID', row.enquiry_id],
    ['Order ID', row.order_id],
    ['Merchant', row.merchant_name || '—'],
    ['Merchant email', row.merchant_email || '—'],
    ['AWB', row.shipment_awb || '—'],
    ['Customer', row.customer_name || '—'],
    ['Phone', row.customer_phone || '—'],
    ['Email', row.customer_email || '—'],
    ['Receipt status', <span className={`status-pill status-${(row.receipt_status || '').toLowerCase()}`}>{formatLabel(row.receipt_status)}</span>],
    ['Status', <span className={`status-pill status-${(row.status || '').toLowerCase()}`}>{formatLabel(row.status)}</span>],
    ['Submitted', row.created_at ? new Date(row.created_at).toLocaleString() : '—'],
  ]
  return (
    <Modal title="Enquiry details" onClose={onClose} width={560}>
      <dl className="enquiry-details-grid">
        {details.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="enquiry-details-message">
        <span>Message</span>
        <p>{row.enquiry_text || '—'}</p>
      </div>
      {row.evidence_url && (
        <a className="evidence-link" href={row.evidence_url} target="_blank" rel="noreferrer">
          View uploaded file
        </a>
      )}
    </Modal>
  )
}

export default function EnquiriesPage() {
  const { admin } = useAuth()
  const [rows, setRows] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [limit, setLimit] = useState(25)
  // /dashboard/<page>?q=... opens the page already searched (used by the top-bar search).
  const [searchParams] = useSearchParams()
  const [q, setQ] = useState(searchParams.get('q') || '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [notesEnquiry, setNotesEnquiry] = useState(null)
  const [resolutionEnquiry, setResolutionEnquiry] = useState(null)
  const [historyEnquiry, setHistoryEnquiry] = useState(null)
  const [detailsEnquiry, setDetailsEnquiry] = useState(null)
  // ?open=1 (from an order's report) opens the details of the one enquiry that was searched for.
  const openOnce = useRef(searchParams.get('open') === '1')
  useEffect(() => {
    if (openOnce.current && rows.length === 1) {
      openOnce.current = false
      setDetailsEnquiry(rows[0])
    }
  }, [rows])

  const { visibleColumns } = useColumnVisibility(
    'securepay_admin_enquiries_columns',
    COLUMNS
  )
  const canManageEnquiries = hasPermission(admin, 'enquiries.manage')

  const load = useCallback(() => {
    setLoading(true)
    api
      .enquiries({ page, q, limit })
      .then((data) => {
        setRows(data.results)
        setTotalPages(data.total_pages)
        setTotal(data.total)
        setError('')
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [page, q, limit])

  useEffect(() => {
    load()
  }, [load])

  function handleSearch(e) {
    e.preventDefault()
    setPage(1)
    setQ(e.target.elements.search.value)
  }

  // Loading/empty rows need to span the pinned Notes + Action columns too,
  // or the placeholder cell won't reach the table's full width.
  const totalColSpan = visibleColumns.length + 3

  return (
    <div className="enquiries-page">
      <div className="panel-card enquiries-surface">
        <div className="section-title enquiries-section-title">
          <div className="section-title-left">
            <span className="orders-section-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M6.5 3.5h11A2.5 2.5 0 0 1 20 6v12a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18V6a2.5 2.5 0 0 1 2.5-2.5Zm2 4a1 1 0 0 0 0 2h7a1 1 0 1 0 0-2h-7Zm0 3.5a1 1 0 1 0 0 2h7a1 1 0 1 0 0-2h-7Zm0 3.5a1 1 0 0 0 0 2h4.5a1 1 0 0 0 0-2H8.5Z" />
              </svg>
            </span>
            Enquiry details
          </div>
        </div>

        <form className="toolbar enquiries-toolbar" onSubmit={handleSearch}>
          <div className="toolbar-field">
            <label htmlFor="search">Search enquiries:</label>
            <input id="search" name="search" placeholder="enquiry id, order id, AWB, merchant, customer, phone…" defaultValue={q} />
          </div>
          <div className="toolbar-field">
            <label htmlFor="rows">Rows:</label>
            <select
              id="rows"
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value))
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

        <div className="table-wrap enquiries-table-wrap">
          <table className="enquiries-table">
            <thead>
              <tr>
                {visibleColumns.map((col) => (
                  <th key={col.key} className={col.className || ''}>{col.label}</th>
                ))}
                {/* Notes/Action always render, regardless of the column picker's
                    selection — they're pinned via CSS (position: sticky; right: …)
                    so they stay visible while the rest of the wide table scrolls. */}
                <th className="enquiry-col-details">Details</th>
                <th className="col-pinned col-pinned-notes">Notes</th>
                <th className="col-pinned col-pinned-action">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={totalColSpan} className="empty-row">Loading…</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={totalColSpan} className="empty-row">No enquiries found.</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    {visibleColumns.map((col) => (
                      <td key={col.key} className={col.className || ''}>{col.render(row)}</td>
                    ))}
                    <td className="enquiry-col-details">
                      <button type="button" className="link-button" onClick={() => setDetailsEnquiry(row)}>
                        Details
                      </button>
                    </td>
                    <td className="col-pinned col-pinned-notes">
                      {row.latest_note ? (
                        <div className="cell-message">{truncate(row.latest_note.note, 60)}</div>
                      ) : (
                        <div className="cell-muted">No notes yet</div>
                      )}
                      <button type="button" className="link-button" onClick={() => setNotesEnquiry(row)}>
                        {row.notes_count > 0 ? `View notes (${row.notes_count})` : canManageEnquiries ? 'Add note' : 'View notes'}
                      </button>
                    </td>
                    <td className="col-pinned col-pinned-action">
                      {/* Reuse the existing green/amber status-pill palette:
                          refunded -> green ("received"), paid to merchant ->
                          blue ("paid"), unresolved -> amber ("pending"). */}
                      <span
                        className={`status-pill status-${(row.resolution_status || 'unresolved') === 'money_refunded' ? 'received' : (row.resolution_status || '') === 'money_to_merchant' ? 'paid' : 'pending'}`}
                      >
                        {RESOLUTION_LABELS[row.resolution_status] || 'Unresolved'}
                      </span>
                      <div className="enquiries-action-buttons">
                        {canManageEnquiries && (
                          <button type="button" className="link-button" onClick={() => setResolutionEnquiry(row)}>
                            Update
                          </button>
                        )}
                        <button type="button" className="link-button" onClick={() => setHistoryEnquiry(row)}>
                          History
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="pagination enquiries-pagination">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Prev
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      </div>

      {detailsEnquiry && <EnquiryDetailsModal row={detailsEnquiry} onClose={() => setDetailsEnquiry(null)} />}
      {notesEnquiry && (
        <NotesModal
          enquiry={notesEnquiry}
          onClose={() => setNotesEnquiry(null)}
          onChanged={load}
          readOnly={!canManageEnquiries}
        />
      )}
      {resolutionEnquiry && (
        <ResolutionModal enquiry={resolutionEnquiry} onClose={() => setResolutionEnquiry(null)} onChanged={load} />
      )}
      {historyEnquiry && (
        <DecisionHistoryModal enquiry={historyEnquiry} onClose={() => setHistoryEnquiry(null)} />
      )}
    </div>
  )
}
