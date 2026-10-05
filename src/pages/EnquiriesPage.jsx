// Cross-merchant enquiry list — data comes from
// adminpanel.api.v1.orders_views.AdminEnquiryListView. This is the page
// admins use to investigate a customer complaint and decide who gets the
// money: NotesModal for the running investigation log, ResolutionModal for
// the final refund/pay-merchant decision + reason.
import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import ColumnPicker from '../components/ColumnPicker'
import DecisionHistoryModal from '../components/DecisionHistoryModal'
import NotesModal from '../components/NotesModal'
import ResolutionModal from '../components/ResolutionModal'
import { useAuth } from '../context/AuthContext'
import { useColumnVisibility } from '../hooks/useColumnVisibility'
import { hasPermission } from '../utils/roles'

function truncate(text, max = 80) {
  if (!text) return '—'
  return text.length > max ? `${text.slice(0, max)}…` : text
}

function yesNo(value) {
  if (value === true) return 'Yes'
  if (value === false) return 'No'
  return '—'
}

const RESOLUTION_LABELS = {
  unresolved: 'Unresolved',
  money_refunded: 'Money Refunded',
  money_to_merchant: 'Money To Merchant',
}

// Notes and Action are rendered separately (pinned columns) — not part of the picker's own list
// keeps them always visible, but they still count toward "columns" conceptually for consistency.
const COLUMNS = [
  { key: 'enquiry_id', label: 'Enquiry ID', className: 'enquiry-col-id', render: (row) => <span className="cell-strong">{row.enquiry_id}</span> },
  { key: 'order_id', label: 'Order ID', className: 'enquiry-col-order', render: (row) => row.order_id },
  {
    key: 'shipment',
    label: 'Shipment ID',
    className: 'enquiry-col-shipment',
    render: (row) => (
      <>
        <div className="cell-strong">{row.shipment_awb || '—'}</div>
        <div className="cell-muted">{row.shipment_courier || ''}</div>
      </>
    ),
  },
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
      <span className={`status-pill status-${(row.receipt_status || '').toLowerCase()}`}>
        {row.receipt_status?.replace(/_/g, ' ')}
      </span>
    ),
  },
  { key: 'someone_else_received', label: 'Someone Else Received', className: 'enquiry-col-boolean-wide', render: (row) => yesNo(row.someone_else_received) },
  { key: 'agent_contacted', label: 'Agent Contacted', className: 'enquiry-col-boolean-wide', render: (row) => yesNo(row.agent_contacted) },
  { key: 'otp_shared', label: 'OTP Shared', className: 'enquiry-col-boolean', render: (row) => yesNo(row.otp_shared) },
  { key: 'unboxing_evidence', label: 'Unboxing Evidence', className: 'enquiry-col-boolean-wide', render: (row) => yesNo(row.unboxing_evidence) },
  {
    key: 'evidence',
    label: 'Evidence',
    className: 'enquiry-col-evidence',
    render: (row) =>
      row.evidence_url ? (
        <a className="evidence-link" href={row.evidence_url} target="_blank" rel="noreferrer">
          View
        </a>
      ) : (
        '—'
      ),
  },
  { key: 'message', label: 'Message', className: 'enquiry-col-message', render: (row) => <div className="cell-message">{truncate(row.enquiry_text)}</div> },
  {
    key: 'status',
    label: 'Status',
    className: 'enquiry-col-status',
    render: (row) => <span className={`status-pill status-${(row.status || '').toLowerCase()}`}>{row.status}</span>,
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

export default function EnquiriesPage() {
  const { admin } = useAuth()
  const [rows, setRows] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [limit, setLimit] = useState(25)
  const [q, setQ] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [notesEnquiry, setNotesEnquiry] = useState(null)
  const [resolutionEnquiry, setResolutionEnquiry] = useState(null)
  const [historyEnquiry, setHistoryEnquiry] = useState(null)

  const { visible, toggle, showAll, hideAll, visibleColumns } = useColumnVisibility(
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
  const totalColSpan = visibleColumns.length + 2

  return (
    <div>
      <h1>SecurePay - Enquiries Dashboard</h1>

      <div className="panel-card">
        <form className="toolbar" onSubmit={handleSearch}>
          <div className="toolbar-field">
            <label htmlFor="search">Search enquiries:</label>
            <input id="search" name="search" placeholder="order id, customer name, phone…" defaultValue={q} />
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
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="panel-card">
        <div className="section-title">
          <div className="section-title-left">
            Enquiries <span className="count-badge">{total}</span>
          </div>
          <ColumnPicker
            columns={COLUMNS}
            visible={visible}
            onToggle={toggle}
            onShowAll={showAll}
            onHideAll={hideAll}
          />
        </div>

        <div className="table-wrap">
          <table className="enquiries-table">
            <thead>
              <tr>
                {visibleColumns.map((col) => (
                  <th key={col.key} className={col.className || ''}>{col.label}</th>
                ))}
                {/* Notes/Action always render, regardless of the column picker's
                    selection — they're pinned via CSS (position: sticky; right: …)
                    so they stay visible while the rest of the wide table scrolls. */}
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
                      {canManageEnquiries && (
                        <button type="button" className="link-button" onClick={() => setResolutionEnquiry(row)}>
                          Update
                        </button>
                      )}
                      <button type="button" className="link-button" onClick={() => setHistoryEnquiry(row)}>
                        History
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="pagination">
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
