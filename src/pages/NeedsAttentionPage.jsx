import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'

function pretty(value) {
  if (value === 'MANUAL_REVIEW' || value === 'UNDER_REVIEW') return 'Needs Review'
  return String(value || '-').replaceAll('_', ' ')
}

function badgeClass(value) {
  const normalized = String(value || '').toUpperCase()
  if (['APPROVED', 'VERIFIED', 'RELEASE', 'REFUND', 'SENT'].includes(normalized)) return 'status-pill status-success'
  if (['NOT_APPROVED', 'NOT_VERIFIED', 'DANGER'].includes(normalized)) return 'status-pill status-failed'
  return 'status-pill status-pending'
}

export default function NeedsAttentionPage() {
  const pageSize = 25
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [actingPdf, setActingPdf] = useState('')
  const [openPdfActions, setOpenPdfActions] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({ type: '', pdfStatus: '', courierStatus: '' })

  const load = useCallback((options = {}) => {
    setLoading(true)
    setError('')
    api
      .needsAttention({ q, sync: options.sync ? '1' : '' })
      .then((data) => setRows(data.results || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [q])

  useEffect(() => {
    load()
  }, [load])

  const filteredRows = useMemo(() => rows.filter((row) => {
    const typeMatches = !filters.type || row.type === filters.type
    const pdfMatches = !filters.pdfStatus || row.pdf_status === filters.pdfStatus
    const courierMatches = !filters.courierStatus || row.courier_status === filters.courierStatus
    return typeMatches && pdfMatches && courierMatches
  }), [filters, rows])
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1)
  const visibleRows = filteredRows.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  async function decidePdf(row, decision) {
    if (!row.vaultpay_order_id) return

    setError('')
    setSuccess('')
    setActingPdf(`${row.vaultpay_order_id}:${decision}`)
    try {
      await api.decideNeedsAttentionPdf(row.vaultpay_order_id, decision)
      setSuccess(`PDF check marked ${pretty(decision)} for ${row.order_id}. PA decision has been re-evaluated.`)
      setOpenPdfActions('')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setActingPdf('')
    }
  }

  function clearFilters() {
    setQ('')
    setFilters({ type: '', pdfStatus: '', courierStatus: '' })
    setPage(1)
  }

  return (
    <div className="needs-attention-page">
      <div className="needs-attention-surface">
        <div className="section-title needs-attention-section-title">
          <div className="section-title-left">
            <span className="orders-section-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M6.5 3.5h11A2.5 2.5 0 0 1 20 6v12a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18V6a2.5 2.5 0 0 1 2.5-2.5Zm2 4a1 1 0 0 0 0 2h7a1 1 0 1 0 0-2h-7Zm0 3.5a1 1 0 1 0 0 2h7a1 1 0 1 0 0-2h-7Zm0 3.5a1 1 0 0 0 0 2h4.5a1 1 0 0 0 0-2H8.5Z" />
              </svg>
            </span>
            Attention review
          </div>
        </div>

        <form
          className="toolbar needs-attention-toolbar"
          onSubmit={(event) => {
            event.preventDefault()
            load()
          }}
        >
          <div className="toolbar-field awb-field">
            <label htmlFor="needs-search">Search queue:</label>
            <input
              id="needs-search"
              value={q}
              onChange={(event) => {
                setQ(event.target.value)
                setPage(1)
              }}
              placeholder="order id, merchant, customer, status"
            />
          </div>
          <div className="toolbar-field">
            <label htmlFor="needs-type">Attention type:</label>
            <select id="needs-type" value={filters.type} onChange={(event) => { setFilters((current) => ({ ...current, type: event.target.value })); setPage(1) }}>
              <option value="">All types</option>
              <option value="missing_label">Shipment label missing</option>
              <option value="pa_review">PA order under review</option>
            </select>
          </div>
          <div className="toolbar-field">
            <label htmlFor="needs-pdf-status">PDF status:</label>
            <select id="needs-pdf-status" value={filters.pdfStatus} onChange={(event) => { setFilters((current) => ({ ...current, pdfStatus: event.target.value })); setPage(1) }}>
              <option value="">All PDF statuses</option>
              <option value="NOT_UPLOADED">Not uploaded</option>
              <option value="NOT_FOUND">Not found</option>
              <option value="NOT_APPROVED">Not approved</option>
              <option value="PROCESSING">Processing</option>
            </select>
          </div>
          <div className="toolbar-field">
            <label htmlFor="needs-courier-status">Courier status:</label>
            <select id="needs-courier-status" value={filters.courierStatus} onChange={(event) => { setFilters((current) => ({ ...current, courierStatus: event.target.value })); setPage(1) }}>
              <option value="">All courier statuses</option>
              <option value="NOT_AVAILABLE">Not available</option>
              <option value="PENDING">Pending</option>
              <option value="NOT_VERIFIED">Not verified</option>
            </select>
          </div>
          <button type="button" onClick={() => load({ sync: true })}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          <button type="button" onClick={clearFilters}>Clear</button>
        </form>

        {error ? <div className="error-banner">{error}</div> : null}
        {success ? <div className="success-banner">{success}</div> : null}

        <div className="table-wrap needs-attention-table-wrap">
          <table className="needs-attention-table">
            <thead>
              <tr>
                <th>Issue</th>
                <th>Merchant</th>
                <th>Order</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>PDF</th>
                <th>Courier</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="empty-row">Loading...</td></tr>
              ) : filteredRows.length === 0 ? (
                <tr><td colSpan={8} className="empty-row">No items need attention.</td></tr>
              ) : visibleRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="cell-strong">{row.title}</div>
                    <div className="cell-muted needs-message">{row.message}</div>
                  </td>
                  <td>
                    <div className="cell-strong">{row.merchant_name || '-'}</div>
                    <div className="cell-muted">{row.merchant_email || ''}</div>
                  </td>
                  <td>
                    <div className="cell-strong wrap-anywhere">{row.order_id || row.pa_order_id || '-'}</div>
                  </td>
                  <td>{row.customer_name || '-'}</td>
                  <td>{row.amount ? `₹${Number(row.amount).toLocaleString('en-IN')}` : '-'}</td>
                  <td>
                    {row.pdf_status ? (
                      <div className="needs-pdf-cell">
                        <button
                          type="button"
                          className={`needs-pdf-chip-button ${badgeClass(row.pdf_status)}`}
                          onClick={() => {
                            if (row.can_decide && ['NOT_FOUND', 'NOT_APPROVED'].includes(row.pdf_status)) {
                              setOpenPdfActions((current) => (current === row.id ? '' : row.id))
                            }
                          }}
                          disabled={!row.can_decide || !['NOT_FOUND', 'NOT_APPROVED'].includes(row.pdf_status)}
                        >
                          {pretty(row.pdf_status)}
                        </button>
                        {row.can_decide && ['NOT_FOUND', 'NOT_APPROVED'].includes(row.pdf_status) && openPdfActions === row.id ? (
                          <div className="needs-pdf-actions">
                            <button
                              type="button"
                              onClick={() => decidePdf(row, 'APPROVED')}
                              disabled={Boolean(actingPdf)}
                            >
                              {actingPdf === `${row.vaultpay_order_id}:APPROVED` ? 'Saving...' : 'Approve'}
                            </button>
                            <button
                              type="button"
                              onClick={() => decidePdf(row, 'NOT_APPROVED')}
                              disabled={Boolean(actingPdf)}
                            >
                              {actingPdf === `${row.vaultpay_order_id}:NOT_APPROVED` ? 'Saving...' : 'Not Approved'}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <span className="cell-muted">-</span>
                    )}
                  </td>
                  <td>
                    {row.courier_status ? (
                      <span className={badgeClass(row.courier_status)}>{pretty(row.courier_status)}</span>
                    ) : (
                      <span className="cell-muted">-</span>
                    )}
                  </td>
                  <td>
                    <span className={badgeClass(row.decision_state || row.action_status)}>
                      {pretty(row.decision_state || row.action_status)}
                    </span>
                    {row.aggregator_request?.status && row.can_decide ? (
                      <div className="cell-muted">
                        {pretty(row.aggregator_request.decision)} request {pretty(row.aggregator_request.status)}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="needs-attention-pagination">
          <span className="needs-attention-pagination-summary">
            Showing {visibleRows.length} of {filteredRows.length} attention items.
          </span>
          <div className="needs-attention-pagination-controls" aria-label="Needs attention pagination">
            <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
              Previous
            </button>
            {pageNumbers.map((pageNumber) => (
              <button
                type="button"
                key={pageNumber}
                className={pageNumber === page ? 'is-active' : ''}
                onClick={() => setPage(pageNumber)}
              >
                {pageNumber}
              </button>
            ))}
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
