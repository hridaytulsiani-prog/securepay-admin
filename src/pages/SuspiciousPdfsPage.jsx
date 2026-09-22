// Cross-merchant view of merchant-uploaded PDFs that failed forgery validation.
import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '-'
}

export default function SuspiciousPdfsPage() {
  const [rows, setRows] = useState([])
  const [merchants, setMerchants] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [limit, setLimit] = useState(25)
  const [q, setQ] = useState('')
  const [filters, setFilters] = useState({
    merchantId: '',
    dateFrom: '',
    dateTo: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    api
      .suspiciousPdfs({
        page,
        q,
        limit,
        merchant_id: filters.merchantId,
        date_from: filters.dateFrom,
        date_to: filters.dateTo,
      })
      .then((data) => {
        setRows(data.results)
        setTotalPages(data.total_pages)
        setTotal(data.total)
        setError('')
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [page, q, limit, filters])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    api
      .merchants()
      .then((data) => setMerchants(data.results || []))
      .catch(() => setMerchants([]))
  }, [])

  function handleSearch(e) {
    e.preventDefault()
    setPage(1)
    setQ(e.target.elements.search.value)
  }

  function handleFilterChange(field, value) {
    setPage(1)
    setFilters((currentFilters) => ({
      ...currentFilters,
      [field]: value,
    }))
  }

  function clearFilters() {
    setPage(1)
    setQ('')
    setFilters({
      merchantId: '',
      dateFrom: '',
      dateTo: '',
    })
  }

  return (
    <div>
      <h1>SecurePay - Suspicious PDFs</h1>

      <div className="panel-card">
        <form className="toolbar" onSubmit={handleSearch}>
          <div className="toolbar-field">
            <label htmlFor="search">Search suspicious PDFs:</label>
            <input id="search" name="search" placeholder="file, merchant, AWB, order id, verdict..." defaultValue={q} />
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
          <div className="toolbar-field">
            <label htmlFor="merchant">Merchant:</label>
            <select
              id="merchant"
              value={filters.merchantId}
              onChange={(e) => handleFilterChange('merchantId', e.target.value)}
            >
              <option value="">All merchants</option>
              {merchants.map((merchant) => (
                <option key={merchant.id} value={merchant.id}>
                  {merchant.merchant_name}
                </option>
              ))}
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
            Suspicious PDFs <span className="count-badge">{total}</span>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>PDF</th>
                <th>Status</th>
                <th>Merchant</th>
                <th>Forgery Verdict</th>
                <th>Courier</th>
                <th>AWB</th>
                <th>Order ID</th>
                <th>Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="empty-row">Loading...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty-row">No suspicious PDFs found.</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="cell-strong">{row.file_name}</div>
                    </td>
                    <td>
                      <span className="status-pill status-not_approved">Not Approved</span>
                    </td>
                    <td>
                      <div className="cell-strong">{row.merchant__merchant_name || '-'}</div>
                      <div className="cell-muted">{row.merchant__merchant_email || '-'}</div>
                      <div className="cell-muted">{row.merchant__merchant_phone || ''}</div>
                    </td>
                    <td>
                      <div className="cell-strong">{row.verdict || '-'}</div>
                      <div className="cell-muted">{row.risk_verdict || ''}</div>
                    </td>
                    <td>
                      <div className="cell-muted">{row.delivery_partner || '-'}</div>
                    </td>
                    <td className="cell-muted">{row.awb || '-'}</td>
                    <td className="cell-muted">{row.order_id || '-'}</td>
                    <td className="cell-muted">{formatDate(row.uploaded_at)}</td>
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
    </div>
  )
}
