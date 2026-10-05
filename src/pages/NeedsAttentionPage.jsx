import { useCallback, useEffect, useState } from 'react'
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
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [actingPdf, setActingPdf] = useState('')
  const [openPdfActions, setOpenPdfActions] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [q, setQ] = useState('')

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

  return (
    <div>
      <h1>SecurePay - Needs Attention</h1>

      <div className="panel-card">
        <form
          className="toolbar"
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
              onChange={(event) => setQ(event.target.value)}
              placeholder="order id, merchant, customer, status"
            />
          </div>
          <button type="submit">{loading ? 'Loading...' : 'Search'}</button>
          <button type="button" onClick={() => load({ sync: true })}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </form>
      </div>

      <div className="panel-card">
        <div className="section-title">
          <div className="section-title-left">
            Attention Queue <span className="count-badge">{rows.length}</span>
          </div>
        </div>

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
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="empty-row">No items need attention.</td></tr>
              ) : rows.map((row) => (
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
                    <div className="cell-strong">{row.order_id || '-'}</div>
                    <div className="cell-muted wrap-anywhere">{row.pa_order_id || ''}</div>
                  </td>
                  <td>{row.customer_name || '-'}</td>
                  <td>{row.currency ? `${row.currency} ${row.amount}` : '-'}</td>
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
      </div>
    </div>
  )
}
