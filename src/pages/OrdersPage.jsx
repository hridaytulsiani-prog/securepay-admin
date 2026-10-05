// Cross-merchant order list — data comes from
// adminpanel.api.v1.orders_views.AdminOrderListView (no merchant filter
// applied by default, unlike the merchant-facing dashboard).
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useColumnVisibility } from '../hooks/useColumnVisibility'
import blueDartLogo from '../../../securepay-client/src/assets/couriers/blue-dart-real.png'
import delhiveryLogo from '../../../securepay-client/src/assets/couriers/delhivery-real.png'
import dtdcLogo from '../../../securepay-client/src/assets/couriers/dtdc-real.png'
import ecomExpressLogo from '../../../securepay-client/src/assets/couriers/ecom-express.png'
import ekartLogo from '../../../securepay-client/src/assets/couriers/ekart-real.png'
import shadowfaxLogo from '../../../securepay-client/src/assets/couriers/shadowfax.svg'
import shiprocketLogo from '../../../securepay-client/src/assets/couriers/shiprocket-real.png'
import xpressbeesLogo from '../../../securepay-client/src/assets/couriers/xpressbees-real.png'

const courierLogos = [
  { keys: ['blue dart', 'bluedart', 'blue_dart'], label: 'Blue Dart', logo: blueDartLogo },
  { keys: ['delhivery'], label: 'Delhivery', logo: delhiveryLogo },
  { keys: ['dtdc'], label: 'DTDC', logo: dtdcLogo },
  { keys: ['ecom express', 'ecomexpress', 'ecom_express'], label: 'Ecom Express', logo: ecomExpressLogo },
  { keys: ['ekart'], label: 'Ekart', logo: ekartLogo },
  { keys: ['shadowfax', 'shadow fax'], label: 'Shadowfax', logo: shadowfaxLogo },
  { keys: ['shiprocket'], label: 'Shiprocket', logo: shiprocketLogo },
  { keys: ['xpressbees', 'xpress bees', 'xpress_bees'], label: 'Xpressbees', logo: xpressbeesLogo },
]

function normalizeCourierName(courier) {
  return String(courier || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function CourierLogoCell({ courier }) {
  const normalized = normalizeCourierName(courier)
  const match = courierLogos.find((item) => item.keys.some((key) => normalizeCourierName(key) === normalized))

  if (!courier) return <span className="courier-logo-empty">-</span>
  if (!match) return <span className="courier-logo-fallback">{courier}</span>

  return (
    <span className="courier-logo-cell" title={match.label}>
      <img src={match.logo} alt={`${match.label} logo`} />
    </span>
  )
}

function formatAmount(value) {
  const amount = Number(value)
  return Number.isFinite(amount) ? `₹${amount.toLocaleString('en-IN')}` : '-'
}

function formatDateTime(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

// Couriers TrackParcel supports for the one-click "Track" button below —
// everything else falls back to the per-courier "-otp" manual check page.
const TRACKPARCEL_SUPPORTED_COURIERS = new Set(['blue dart', 'bluedart', 'delhivery', 'dtdc', 'shadowfax', 'xpressbees'])

function isTrackParcelSupported(courier) {
  return TRACKPARCEL_SUPPORTED_COURIERS.has(normalizeCourierName(courier))
}

function TrackParcelTrackButton({ awb, courier }) {
  const [tracking, setTracking] = useState(false)
  const [error, setError] = useState('')

  async function handleTrack() {
    setTracking(true)
    setError('')
    try {
      await api.trackParcel(awb)
      window.dispatchEvent(new Event('securepay-orders-refresh'))
    } catch (err) {
      setError(err.message)
    } finally {
      setTracking(false)
    }
  }

  return (
    <button
      type="button"
      className="table-action-link shipsagar-track-button"
      onClick={handleTrack}
      disabled={tracking}
      title={error || `Refresh ${courier} status from TrackParcel`}
    >
      {tracking ? 'Checking...' : 'Track'}
    </button>
  )
}

// Column defs double as both the table header/cell renderer and the list
// ColumnPicker offers to show/hide — keeping them in one array avoids the
// two ever drifting out of sync.
const COLUMNS = [
  {
    key: 'order_id',
    label: 'Order ID',
    render: (row) => <span className="cell-strong cell-single-line">{row.merchant_order_id || row.pa_order_id || '-'}</span>,
  },
  {
    key: 'awb',
    label: 'AWB',
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
  {
    key: 'customer',
    label: 'Customer',
    render: (row) => <span className="cell-single-line">{row.customer_info__customer_name}</span>,
  },
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
  { key: 'amount', label: 'Amount', render: (row) => <span className="cell-single-line">{formatAmount(row.order_amount)}</span> },
  {
    key: 'status',
    label: 'Payment Status',
    render: (row) => (
      <span className="table-chip-cell">
        <span className={`status-pill status-${(row.order_status || '').toLowerCase()}`}>{row.order_status}</span>
      </span>
    ),
  },
  {
    key: 'courier',
    label: 'Courier',
    render: (row) => <CourierLogoCell courier={row.shipment_id__courier} />,
  },
  {
    key: 'shipment_status',
    label: 'Shipment Status',
    render: (row) => (
      <span className="table-chip-cell">
        <span className={`status-pill status-${(row.shipment_id__status || '').toLowerCase()}`}>
          {row.shipment_id__status || '-'}
        </span>
      </span>
    ),
  },
  {
    key: 'shipment_label',
    label: 'Shipment Label',
    render: (row) => {
      if (row.shipment_label_status === 'approved') {
        return <span className="table-chip-cell"><span className="status-pill status-approved">Approved</span></span>
      }
      if (row.shipment_label_status === 'processing') {
        return <span className="table-chip-cell"><span className="status-pill status-pending">Under Review</span></span>
      }
      if (row.shipment_label_status === 'not_approved') {
        return <span className="table-chip-cell"><span className="status-pill status-not_approved">Not Approved</span></span>
      }
      return <span className="table-chip-cell"><span className="status-pill status-missing">Yet to Upload</span></span>
    },
  },
  {
    key: 'shipment_label_pdf',
    label: 'PDF Name',
    render: (row) => (
      <span className="cell-muted cell-single-line">
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
      if (!row.shipment_id__awb) return <span className="table-chip-cell"><span className="cell-muted">-</span></span>
      if (row.verification_status === 'VERIFIED') {
        return <span className="table-chip-cell"><span className="status-pill status-success">Verified</span></span>
      }
      if (row.verification_status === 'NOT_VERIFIED') {
        return <span className="table-chip-cell"><span className="status-pill status-failed">Not Verified</span></span>
      }
      return <span className="table-chip-cell"><span className="status-pill status-pending">Pending Check</span></span>
    },
  },
  {
    key: 'track',
    label: 'Track',
    render: (row) => {
      const courier = String(row.shipment_id__courier || '').toLowerCase()
      if (isTrackParcelSupported(courier)) {
        return row.shipment_id__awb ? (
          <TrackParcelTrackButton awb={row.shipment_id__awb} courier={row.shipment_id__courier} />
        ) : <span className="cell-muted">-</span>
      }
      const trackingPath = courier.includes('shiprocket')
        ? 'shiprocket-otp'
        : courier.includes('ekart')
          ? 'ekart-otp'
          : 'delhivery-otp'

      return row.shipment_id__awb ? (
        <Link className="table-action-link" to={`/dashboard/${trackingPath}?awb=${encodeURIComponent(row.shipment_id__awb)}`}>
          Track
        </Link>
      ) : (
        <span className="cell-muted">-</span>
      )
    },
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
    courier: '',
    deliveryStatus: '',
    shipmentLabelStatus: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1)

  const { visibleColumns } = useColumnVisibility(
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
        courier: filters.courier,
        delivery_status: filters.deliveryStatus,
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
    const refreshOrders = () => load()
    window.addEventListener('securepay-orders-refresh', refreshOrders)
    return () => window.removeEventListener('securepay-orders-refresh', refreshOrders)
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
      courier: '',
      deliveryStatus: '',
      shipmentLabelStatus: '',
    })
  }

  return (
    <div className="orders-page">
      <div className="panel-card orders-surface">
        <div className="section-title orders-section-title">
          <div className="section-title-left">
            <span className="orders-section-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M6.5 3.5h11A2.5 2.5 0 0 1 20 6v12a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18V6a2.5 2.5 0 0 1 2.5-2.5Zm2 4a1 1 0 0 0 0 2h7a1 1 0 1 0 0-2h-7Zm0 3.5a1 1 0 1 0 0 2h7a1 1 0 0 0 0-2h-7Zm0 3.5a1 1 0 0 0 0 2h4.5a1 1 0 0 0 0-2H8.5Z" />
              </svg>
            </span>
            Order details
          </div>
        </div>
        <form className="toolbar orders-toolbar" onSubmit={handleSearch}>
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
          <div className="toolbar-field">
            <label htmlFor="courier">Courier:</label>
            <select id="courier" value={filters.courier} onChange={(e) => handleFilterChange('courier', e.target.value)}>
              <option value="">All couriers</option>
              <option value="Delhivery">Delhivery</option>
              <option value="DTDC">DTDC</option>
              <option value="Shiprocket">Shiprocket</option>
              <option value="Ekart">Ekart</option>
              <option value="Shadowfax">Shadowfax</option>
              <option value="Xpressbees">Xpressbees</option>
              <option value="Blue Dart">Blue Dart</option>
            </select>
          </div>
          <div className="toolbar-field">
            <label htmlFor="delivery-status">Delivery status:</label>
            <select
              id="delivery-status"
              value={filters.deliveryStatus}
              onChange={(e) => handleFilterChange('deliveryStatus', e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="CREATED">Created</option>
              <option value="IN_TRANSIT">In transit</option>
              <option value="OUT_FOR_DELIVERY">Out for delivery</option>
              <option value="DELIVERED">Delivered</option>
              <option value="RTO">RTO</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          <button type="button" onClick={load}>
            Refresh
          </button>
          <button type="button" onClick={clearFilters}>
            Clear
          </button>
        </form>
      {error && <div className="error-banner">{error}</div>}

      <div className="section-title table-section-title">
        <div className="section-title-left">
          <span className="orders-section-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M6.5 3.5h11A2.5 2.5 0 0 1 20 6v12a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18V6a2.5 2.5 0 0 1 2.5-2.5Zm2 4a1 1 0 0 0 0 2h7a1 1 0 1 0 0-2h-7Zm0 3.5a1 1 0 1 0 0 2h7a1 1 0 1 0 0-2h-7Zm0 3.5a1 1 0 1 0 0 2h4.5a1 1 0 1 0 0-2H8.5Z" />
            </svg>
          </span>
          Order details
        </div>
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

      <div className="orders-pagination">
          <span className="orders-pagination-summary">Showing {rows.length} of {total} payment orders.</span>
          <div className="orders-pagination-controls" aria-label="Payment order pagination">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            {pageNumbers.map((pageNumber) => (
              <button
                key={pageNumber}
                className={pageNumber === page ? 'is-active' : ''}
                onClick={() => setPage(pageNumber)}
              >
                {pageNumber}
              </button>
            ))}
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>
      </div>
      </div>
    </div>
  )
}
