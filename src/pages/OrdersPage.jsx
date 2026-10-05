// Cross-merchant order list — data comes from
// adminpanel.api.v1.orders_views.AdminOrderListView (no merchant filter
// applied by default, unlike the merchant-facing dashboard).
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import ColumnPicker from '../components/ColumnPicker'
import { useColumnVisibility } from '../hooks/useColumnVisibility'

// Column defs double as both the table header/cell renderer and the list
// ColumnPicker offers to show/hide — keeping them in one array avoids the
// two ever drifting out of sync.
const COLUMNS = [
  {
    key: 'order_id',
    label: 'Order ID',
    render: (row) => (
      <>
        <div className="cell-strong">{row.merchant_order_id}</div>
        <div className="cell-muted">{row.pa_order_id}</div>
      </>
    ),
  },
  {
    key: 'awb',
    label: 'AWB Number',
    render: (row) => <span className="cell-strong">{row.shipment_id__awb || '-'}</span>,
  },
  {
    key: 'merchant',
    label: 'Merchant',
    render: (row) => (
      <>
        <div className="cell-strong">{row.merchant__merchant_name}</div>
        <div className="cell-muted">{row.merchant__merchant_email}</div>
      </>
    ),
  },
  { key: 'customer', label: 'Customer', render: (row) => row.customer_info__customer_name },
  {
    key: 'contact',
    label: 'Contact',
    render: (row) => (
      <>
        <div className="cell-muted">{row.customer_info__customer_phone}</div>
        <div className="cell-muted">{row.customer_info__customer_email}</div>
      </>
    ),
  },
  { key: 'amount', label: 'Amount', render: (row) => `${row.order_currency} ${row.order_amount}` },
  {
    key: 'status',
    label: 'Status',
    render: (row) => (
      <span className={`status-pill status-${(row.order_status || '').toLowerCase()}`}>{row.order_status}</span>
    ),
  },
  {
    key: 'shipment',
    label: 'Shipment Status',
    render: (row) => (
      <>
        <div className="cell-muted">{row.shipment_id__courier || '-'}</div>
        <div className="cell-muted">{row.shipment_id__status || ''}</div>
      </>
    ),
  },
  {
    key: 'shipment_label',
    label: 'Shipment Label',
    render: (row) => {
      if (row.shipment_label_status === 'approved') {
        return <span className="status-pill status-approved">Approved</span>
      }
      if (row.shipment_label_status === 'processing') {
        return <span className="status-pill status-pending">Under Review</span>
      }
      if (row.shipment_label_status === 'not_approved') {
        return <span className="status-pill status-not_approved">Not Approved</span>
      }
      return <span className="status-pill status-missing">Yet to Upload</span>
    },
  },
  {
    key: 'shipment_label_pdf',
    label: 'PDF Name',
    render: (row) => (
      <span className="cell-muted">
        {['approved', 'not_approved'].includes(row.shipment_label_status) ? row.shipment_label_file_name || '-' : '-'}
      </span>
    ),
  },
  {
    key: 'date',
    label: 'Date',
    render: (row) => (
      <span className="cell-muted">{row.order_date ? new Date(row.order_date).toLocaleString() : '—'}</span>
    ),
  },
  {
    key: 'verification_status',
    label: 'Verification Status',
    render: (row) => {
      if (!row.shipment_id__awb) return <span className="cell-muted">-</span>
      if (row.verification_status === 'VERIFIED') {
        return <span className="status-pill status-success">Verified</span>
      }
      if (row.verification_status === 'NOT_VERIFIED') {
        return <span className="status-pill status-failed">Not Verified</span>
      }
      return <span className="status-pill status-pending">Pending Check</span>
    },
  },
  {
    key: 'track',
    label: 'Track',
    render: (row) =>
      row.shipment_id__awb ? (
        <Link className="table-action-link" to={`/dashboard/delhivery-otp?awb=${encodeURIComponent(row.shipment_id__awb)}`}>
          Track
        </Link>
      ) : (
        <span className="cell-muted">-</span>
      ),
  },
]

export default function OrdersPage() {
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
    shipmentLabelStatus: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const { visible, toggle, showAll, hideAll, visibleColumns } = useColumnVisibility(
    'securepay_admin_orders_columns',
    COLUMNS
  )

  // Re-fetches whenever page/search/page-size changes; also exposed as the
  // Refresh button's click handler for a manual re-pull.
  const load = useCallback(() => {
    setLoading(true)
    api
      .orders({
        page,
        q,
        limit,
        merchant_id: filters.merchantId,
        date_from: filters.dateFrom,
        date_to: filters.dateTo,
        shipment_label_status: filters.shipmentLabelStatus,
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
    setPage(1) // a new search always restarts from page 1
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
      shipmentLabelStatus: '',
    })
  }

  return (
    <div>
      <h1>SecurePay - Orders Dashboard</h1>

      <div className="panel-card">
        <form className="toolbar" onSubmit={handleSearch}>
          <div className="toolbar-field">
            <label htmlFor="search">Search orders:</label>
            <input id="search" name="search" placeholder="order id, customer name, merchant…" defaultValue={q} />
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
          <div className="toolbar-field">
            <label htmlFor="shipment-label-status">Shipment Label:</label>
            <select
              id="shipment-label-status"
              value={filters.shipmentLabelStatus}
              onChange={(e) => handleFilterChange('shipmentLabelStatus', e.target.value)}
            >
              <option value="">All labels</option>
              <option value="approved">Approved</option>
              <option value="processing">Under Review</option>
              <option value="not_approved">Not Approved</option>
              <option value="missing">Yet to Upload</option>
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
            Orders <span className="count-badge">{total}</span>
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
          <table>
            <thead>
              <tr>
                {visibleColumns.map((col) => (
                  <th key={col.key}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={visibleColumns.length || 1} className="empty-row">Loading…</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length || 1} className="empty-row">No orders found.</td>
                </tr>
              ) : visibleColumns.length === 0 ? (
                <tr>
                  <td className="empty-row">No columns selected.</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    {visibleColumns.map((col) => (
                      <td key={col.key}>{col.render(row)}</td>
                    ))}
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
