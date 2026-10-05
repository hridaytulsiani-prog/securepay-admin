import { Fragment, useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '-'
}

function formatAction(value) {
  return (value || '').replace(/_/g, ' ')
}

function auditOrderId(row) {
  return row.order_id || row.metadata?.merchant_order_id || row.metadata?.order_id || row.metadata?.provider_order_id || '-'
}

function formatLabel(value) {
  const labels = {
    note: 'Note',
    note_id: 'Note ID',
    status: 'Enquiry Status',
    resolution_status: 'Decision',
    resolution_reason: 'Reason',
    resolved_by: 'Decision By',
    resolved_at: 'Decision Time',
    provider: 'Provider',
    amount: 'Amount',
    currency: 'Currency',
    provider_payment_id: 'Provider Payment ID',
    provider_refund_id: 'Provider Refund ID',
    refund_reference: 'Refund Reference',
    order_status: 'Order Status',
    payment_state: 'Payment State',
    error: 'Error',
    provider_submitted_at: 'Provider Submitted At',
    completed_at: 'Completed At',
  }
  return labels[value] || formatAction(value).replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatProofValue(key, value) {
  if (value === null || value === undefined || value === '') return 'Not set'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (key.endsWith('_at') || key.includes('time')) return formatDate(value)
  if (typeof value === 'string') return formatAction(value)
  if (typeof value === 'number') return value
  if (Array.isArray(value)) return value.length ? value.map((item) => formatProofValue(key, item)).join(', ') : 'None'
  return JSON.stringify(value)
}

function ProofInfo({ value }) {
  if (!value || (Array.isArray(value) && value.length === 0) || Object.keys(value).length === 0) {
    return <span className="cell-muted">-</span>
  }
  return (
    <div className="audit-proof-list">
      {Object.entries(value).map(([key, item]) => (
        <div className="audit-proof-row" key={key}>
          <span>{formatLabel(key)}</span>
          <strong>{formatProofValue(key, item)}</strong>
        </div>
      ))}
    </div>
  )
}

export default function AuditTrailPage() {
  const [rows, setRows] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [limit, setLimit] = useState(25)
  const [q, setQ] = useState('')
  const [filters, setFilters] = useState({
    caseType: '',
    action: '',
    dateFrom: '',
    dateTo: '',
  })
  const [expandedId, setExpandedId] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    api
      .auditLogs({
        page,
        q,
        limit,
        case_type: filters.caseType,
        action: filters.action,
        date_from: filters.dateFrom,
        date_to: filters.dateTo,
      })
      .then((data) => {
        setRows(data.results || [])
        setTotalPages(data.total_pages || 1)
        setTotal(data.total || 0)
        setError('')
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [page, q, limit, filters])

  useEffect(() => {
    load()
  }, [load])

  function handleSearch(e) {
    e.preventDefault()
    setPage(1)
    setQ(e.target.elements.search.value)
  }

  function handleFilterChange(field, value) {
    setPage(1)
    setFilters((current) => ({ ...current, [field]: value }))
  }

  function clearFilters() {
    setPage(1)
    setQ('')
    setFilters({ caseType: '', action: '', dateFrom: '', dateTo: '' })
  }

  return (
    <div>
      <h1>SecurePay - Audit Trail</h1>

      <div className="panel-card">
        <form className="toolbar" onSubmit={handleSearch}>
          <div className="toolbar-field">
            <label htmlFor="search">Search logs:</label>
            <input id="search" name="search" placeholder="case id, action, actor, remarks..." defaultValue={q} />
          </div>
          <div className="toolbar-field">
            <label htmlFor="case-type">Case type:</label>
            <select
              id="case-type"
              value={filters.caseType}
              onChange={(e) => handleFilterChange('caseType', e.target.value)}
            >
              <option value="">All types</option>
              <option value="enquiry">Enquiry</option>
              <option value="refund">Refund</option>
              <option value="order">Order</option>
              <option value="payment">Payment</option>
            </select>
          </div>
          <div className="toolbar-field">
            <label htmlFor="action">Action:</label>
            <select
              id="action"
              value={filters.action}
              onChange={(e) => handleFilterChange('action', e.target.value)}
            >
              <option value="">All actions</option>
              <option value="note_created">Note Created</option>
              <option value="note_updated">Note Updated</option>
              <option value="note_deleted">Note Deleted</option>
              <option value="resolution_updated">Resolution Updated</option>
              <option value="refund_requested">Refund Requested</option>
              <option value="refund_request_updated">Refund Request Updated</option>
              <option value="refund_submitted_to_provider">Refund Submitted</option>
              <option value="refund_webhook_received">Refund Webhook Received</option>
              <option value="refund_completed">Refund Completed</option>
            </select>
          </div>
          <div className="toolbar-field">
            <label htmlFor="date-from">From date:</label>
            <input
              id="date-from"
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
            />
          </div>
          <div className="toolbar-field">
            <label htmlFor="date-to">To date:</label>
            <input
              id="date-to"
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
            />
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
          <button type="button" onClick={clearFilters}>
            Clear
          </button>
        </form>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="panel-card">
        <div className="section-title">
          <div className="section-title-left">
            Audit Logs <span className="count-badge">{total}</span>
          </div>
        </div>

        <div className="table-wrap audit-table-wrap">
          <table className="audit-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Case</th>
                <th>Order ID</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Role</th>
                <th>Remarks</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="empty-row">Loading...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty-row">No audit logs found.</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <Fragment key={row.id}>
                    <tr key={row.id}>
                      <td><span className="cell-muted">{formatDate(row.created_at)}</span></td>
                      <td>
                        <div className="cell-strong">{row.case_id}</div>
                        <div className="cell-muted">{row.case_type}</div>
                      </td>
                      <td><span className="cell-strong">{auditOrderId(row)}</span></td>
                      <td><span className="status-pill status-created">{formatAction(row.action)}</span></td>
                      <td>{row.actor || '-'}</td>
                      <td>{row.actor_role || '-'}</td>
                      <td><div className="cell-message">{row.remarks || '-'}</div></td>
                      <td>
                        <button
                          type="button"
                          className="table-action-link"
                          onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                        >
                          {expandedId === row.id ? 'Hide' : 'View'}
                        </button>
                      </td>
                    </tr>
                    {expandedId === row.id && (
                      <tr key={`${row.id}-details`}>
                        <td colSpan={8}>
                          <div className="audit-detail-grid">
                            <div>
                              <h3>Old Values</h3>
                              <ProofInfo value={row.old_values} />
                            </div>
                            <div>
                              <h3>New Values</h3>
                              <ProofInfo value={row.new_values} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
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
    </div>
  )
}
