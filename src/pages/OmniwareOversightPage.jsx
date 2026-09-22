import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'

const RECOMMENDATIONS = [
  { value: '', label: 'All decisions' },
  { value: 'REFUND_RECOMMENDED', label: 'Refund recommended' },
  { value: 'RELEASE_RECOMMENDED', label: 'Release recommended' },
  { value: 'REFUND_IN_PROGRESS', label: 'Refund in progress' },
  { value: 'REFUNDED', label: 'Refunded' },
  { value: 'REVIEW_PENDING', label: 'Review pending' },
]

function statusClass(value) {
  return `status-pill status-${String(value || '').toLowerCase()}`
}

function pretty(value) {
  return String(value || '-').replaceAll('_', ' ').toLowerCase()
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '-'
}

function EvidenceBlock({ verification }) {
  const items = [
    `PDF: ${pretty(verification?.pdf)}`,
    `AWB: ${pretty(verification?.awb)}`,
    `Delivery: ${pretty(verification?.delivery)}`,
  ]

  return (
    <div className="evidence-text">
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function GuardrailBlock({ guardrails }) {
  return (
    <div className="guardrail-list">
      {(guardrails || []).map((item) => (
        <div className="guardrail-item" key={item.name}>
          <span className={statusClass(item.status)}>{pretty(item.status)}</span>
          <div>
            <div className="cell-strong">{item.name}</div>
            <div className="cell-muted">{item.detail}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function AuditBlock({ audit }) {
  if (!audit?.length) return <span className="cell-muted">No state transitions yet</span>
  return (
    <div className="audit-stack">
      {audit.slice(0, 3).map((item, index) => (
        <div className="audit-line" key={`${item.created_at}-${index}`}>
          <span className="cell-strong">{item.to_state}</span>
          <span className="cell-muted">{item.source} - {formatDate(item.created_at)}</span>
        </div>
      ))}
    </div>
  )
}

export default function OmniwareOversightPage({ partnerMode = false }) {
  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState({})
  const [merchants, setMerchants] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [limit, setLimit] = useState(25)
  const [q, setQ] = useState('')
  const [filters, setFilters] = useState({
    merchantId: '',
    recommendation: '',
    dateFrom: '',
    dateTo: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    const fetchReport = partnerMode ? api.omniwarePartnerOversight : api.omniwareOversight
    fetchReport({
        page,
        limit,
        q,
        merchant_id: filters.merchantId,
        recommendation: filters.recommendation,
        date_from: filters.dateFrom,
        date_to: filters.dateTo,
      })
      .then((data) => {
        setRows(data.results || [])
        setSummary(data.summary || {})
        setTotalPages(data.total_pages || 1)
        setTotal(data.total || 0)
        setError('')
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [page, limit, q, filters, partnerMode])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (partnerMode) return
    api
      .merchants()
      .then((data) => setMerchants(data.results || []))
      .catch(() => setMerchants([]))
  }, [partnerMode])

  function handleSearch(event) {
    event.preventDefault()
    setPage(1)
    setQ(event.target.elements.search.value)
  }

  function handleFilterChange(field, value) {
    setPage(1)
    setFilters((current) => ({ ...current, [field]: value }))
  }

  function clearFilters() {
    setPage(1)
    setQ('')
    setFilters({ merchantId: '', recommendation: '', dateFrom: '', dateTo: '' })
  }

  return (
    <div>
      <h1>{partnerMode ? 'SecurePay Partner Oversight' : 'Aggregator Oversight Report'}</h1>

      <div className="stat-grid oversight-stat-grid">
        <div className="stat-card">
          <div className="stat-value">{summary.refund_recommended || 0}</div>
          <div className="stat-label">Refund recommended</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{summary.release_recommended || 0}</div>
          <div className="stat-label">Release recommended</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{summary.refund_in_progress || 0}</div>
          <div className="stat-label">Refund in progress</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{summary.refunded || 0}</div>
          <div className="stat-label">Refunded</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{summary.review_pending || 0}</div>
          <div className="stat-label">Review pending</div>
        </div>
      </div>

      <div className="panel-card">
        <form className="toolbar" onSubmit={handleSearch}>
          <div className="toolbar-field">
            <label htmlFor="search">Search:</label>
            <input id="search" name="search" placeholder="order, transaction, merchant, customer, AWB" defaultValue={q} />
          </div>
          <div className="toolbar-field">
            <label htmlFor="rows">Rows:</label>
            <select id="rows" value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1) }}>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          {!partnerMode && (
            <div className="toolbar-field">
              <label htmlFor="merchant">Merchant:</label>
              <select id="merchant" value={filters.merchantId} onChange={(e) => handleFilterChange('merchantId', e.target.value)}>
                <option value="">All merchants</option>
                {merchants.map((merchant) => (
                  <option key={merchant.id} value={merchant.id}>{merchant.merchant_name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="toolbar-field">
            <label htmlFor="recommendation">Decision:</label>
            <select id="recommendation" value={filters.recommendation} onChange={(e) => handleFilterChange('recommendation', e.target.value)}>
              {RECOMMENDATIONS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </div>
          <div className="toolbar-field">
            <label htmlFor="date-from">From:</label>
            <input id="date-from" type="date" value={filters.dateFrom} onChange={(e) => handleFilterChange('dateFrom', e.target.value)} />
          </div>
          <div className="toolbar-field">
            <label htmlFor="date-to">To:</label>
            <input id="date-to" type="date" value={filters.dateTo} onChange={(e) => handleFilterChange('dateTo', e.target.value)} />
          </div>
          <button type="submit">Search</button>
          <button type="button" onClick={load}>Refresh</button>
          <button type="button" onClick={clearFilters}>Clear</button>
        </form>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="panel-card">
        <div className="section-title">
          <div className="section-title-left">
            Decisions <span className="count-badge">{total}</span>
          </div>
        </div>

        <div className="table-wrap oversight-table-wrap">
          <table className="oversight-table">
            <thead>
              <tr>
                <th className="col-decision">Decision</th>
                <th className="col-order">Order</th>
                <th className="col-merchant">Merchant</th>
                <th className="col-money">Money State</th>
                <th className="col-evidence">Evidence</th>
                <th className="col-refund">Refund</th>
                <th className="col-guardrails">Guardrails</th>
                <th className="col-audit">Audit Trail</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="empty-row">Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="empty-row">No decisions found.</td></tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.decision_id}>
                    <td className="col-decision">
                      <div className="decision-cell">
                        <div className="cell-strong">{row.decision_id}</div>
                        <span className={statusClass(row.recommendation)}>{pretty(row.recommendation)}</span>
                        <div className="cell-muted">{formatDate(row.created_at)}</div>
                      </div>
                    </td>
                    <td className="col-order">
                      <div className="cell-strong">{row.order_id}</div>
                      <div className="cell-muted wrap-anywhere">Provider order: {row.provider_order_id || '-'}</div>
                      <div className="cell-muted wrap-anywhere">Txn: {row.provider_payment_id || '-'}</div>
                      <div className="cell-muted">AWB: {row.shipment?.awb || '-'}</div>
                    </td>
                    <td className="col-merchant">
                      <div className="cell-strong">{row.merchant?.name || '-'}</div>
                      <div className="cell-muted">{row.merchant?.email || '-'}</div>
                      <div className="cell-muted">{row.customer?.name || '-'}</div>
                    </td>
                    <td className="col-money">
                      <div className="money-state-cell">
                        <div className="cell-strong">{row.currency} {row.amount}</div>
                        <span className={statusClass(row.payment_state)}>{pretty(row.payment_state)}</span>
                      </div>
                    </td>
                    <td className="col-evidence"><EvidenceBlock verification={row.verification} /></td>
                    <td className="col-refund">
                      {row.refund?.reference ? (
                        <>
                          <div className="cell-strong">{row.refund.reference}</div>
                          <span className={statusClass(row.refund.status)}>{pretty(row.refund.status)}</span>
                          <div className="cell-muted">ID: {row.refund.provider_refund_id || '-'}</div>
                          <div className="cell-muted">{row.refund.reason || '-'}</div>
                        </>
                      ) : (
                        <span className="cell-muted">No refund request</span>
                      )}
                    </td>
                    <td className="col-guardrails"><GuardrailBlock guardrails={row.guardrails} /></td>
                    <td className="col-audit"><AuditBlock audit={row.audit} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="pagination">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
          <span>Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      </div>
    </div>
  )
}
