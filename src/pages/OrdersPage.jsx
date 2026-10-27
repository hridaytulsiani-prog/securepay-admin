// Cross-merchant order list — data comes from
// adminpanel.api.v1.orders_views.AdminOrderListView (no merchant filter
// applied by default, unlike the merchant-facing dashboard).
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useColumnVisibility } from '../hooks/useColumnVisibility'
import Modal from '../components/Modal'
import blueDartLogo from '../assets/couriers/blue-dart-real.png'
import delhiveryLogo from '../assets/couriers/delhivery-real.png'
import dtdcLogo from '../assets/couriers/dtdc-real.png'
import ecomExpressLogo from '../assets/couriers/ecom-express.png'
import ekartLogo from '../assets/couriers/ekart-real.png'
import shadowfaxLogo from '../assets/couriers/shadowfax.svg'
import shiprocketLogo from '../assets/couriers/shiprocket-real.png'
import xpressbeesLogo from '../assets/couriers/xpressbees-wordmark.svg'

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

function findCourierLogo(courier) {
  const normalized = normalizeCourierName(courier)
  if (!normalized) return null
  return courierLogos.find((item) => item.keys.some((key) => {
    const normalizedKey = normalizeCourierName(key)
    return normalized === normalizedKey || normalized.includes(normalizedKey)
  }))
}

function CourierLogoCell({ courier }) {
  const match = findCourierLogo(courier)

  if (!courier) return <span className="courier-logo-empty">-</span>
  if (!match) return <span className="courier-logo-fallback">{courier}</span>

  return (
    <span className={`courier-logo-cell courier-logo-${normalizeCourierName(match.label).replaceAll(' ', '-')}`} title={courier}>
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

function normalizedOrderState(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
}

function orderStateIncludes(value, terms) {
  const state = normalizedOrderState(value)
  return terms.some((term) => state.includes(term))
}

function orderRowTone(row) {
  if (row.row_tone) return row.row_tone
  const hasFailure = [row.payment_state, row.order_status, row.shipment_id__status, row.shipment_label_status]
    .some((value) => orderStateIncludes(value, ['failed', 'rejected', 'not_approved', 'cancelled', 'canceled', 'lost', 'damaged', 'returned', 'rto', 'refund']))
    || normalizedOrderState(row.verification_status) === 'not_verified'

  if (row.issue_status === 'open' || hasFailure) return 'failed'
  if (row.issue_status === 'in_progress') return 'pending'
  if (row.issue_status === 'resolved') return 'resolved'

  const paymentComplete = orderStateIncludes(row.payment_state || row.order_status, ['paid', 'success', 'captured', 'settled', 'completed', 'released'])
  const deliveryComplete = orderStateIncludes(row.shipment_id__status, ['delivered', 'completed'])
  const labelApproved = ['approved', 'shipment_linked'].includes(normalizedOrderState(row.shipment_label_status))
  const courierVerified = normalizedOrderState(row.verification_status) === 'verified'
  return paymentComplete && deliveryComplete && labelApproved && courierVerified ? 'success' : 'pending'
}

const PAGE_SIZE = 25
const ROW_TONE_FILTERS = [
  { value: '', label: 'All rows' },
  { value: 'success', label: 'Green (Successful)' },
  { value: 'pending', label: 'Yellow (Ongoing)' },
  { value: 'failed', label: 'Red (Failed / new issue)' },
  { value: 'resolved', label: 'Blue (Issues resolved)' },
]

function issueStatusClass(status) {
  const value = normalizedOrderState(status)
  if (value === 'resolved') return 'status-resolved'
  if (value === 'in_progress') return 'status-pending'
  return 'status-failed'
}

function formatDateOnly(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatStatusLabel(value) {
  if (!value) return '-'
  return String(value)
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatPaymentStatus(value) {
  const normalized = String(value || '').trim().toUpperCase()
  const labels = {
    CREATED: 'Payment Captured',
    PAYMENT_PENDING: 'Payment Captured',
    PAYMENT_CAPTURED: 'Payment Captured',
    FUNDS_HELD: 'Payment Captured',
    SETTLEMENT_ELIGIBLE: 'Payment Captured',
    SETTLEMENT_PROCESSING: 'Payment Processing',
    SETTLED: 'Settled',
    PAYMENT_FAILED: 'Payment Failed',
    REFUND_PENDING: 'Payment Processing',
    REFUNDED: 'Refunded',
    DISPUTED: 'Payment Disputed',
  }
  if (labels[normalized]) return labels[normalized]
  if (normalized === 'PAID') return 'Payment Captured'
  return formatStatusLabel(value)
}

function paymentStatusClass(row) {
  const state = String(row.payment_state || '').trim().toLowerCase()
  if (['created', 'payment_pending', 'paid', 'payment_captured', 'funds_held', 'settlement_eligible', 'settled'].includes(state)) {
    return 'status-paid'
  }
  if (['settlement_processing', 'refund_pending'].includes(state)) return 'status-pending'
  if (['payment_failed', 'refunded', 'disputed'].includes(state)) return 'status-failed'
  return 'status-pending'
}

function StatusPill({ value, className = '' }) {
  if (!value) {
    return <span className="status-dash">-</span>
  }
  return <span className={`status-pill ${className}`}>{value}</span>
}

// Couriers TrackParcel supports for the one-click "Track" button below —
// everything else falls back to the per-courier "-otp" manual check page.
const TRACKPARCEL_SUPPORTED_COURIERS = new Set(['blue dart', 'bluedart', 'delhivery', 'dtdc', 'shadowfax', 'xpressbees'])

function isTrackParcelSupported(courier) {
  const normalized = normalizeCourierName(courier)
  return Array.from(TRACKPARCEL_SUPPORTED_COURIERS).some((key) => (
    normalized === key || normalized.includes(key)
  ))
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

function LabelReportModal({ report, onClose }) {
  if (!report) return null

  const shownRows = report.rows || []

  return (
    <div className="modal-overlay label-report-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal-card label-report-modal" role="dialog" aria-modal="true" aria-label="Shipment label rejection report">
        <div className="modal-header">
          <div className="label-report-title">
            <span>Shipment label report</span>
            <h3>{report.file_name || 'Rejected PDF'}</h3>
          </div>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="modal-body label-report-body">
          <div className="label-report-failure">
            <span>Failure basis</span>
            <p>{report.failure_summary || 'One or more required validation checks failed.'}</p>
          </div>

          <div className="label-report-table-wrap">
            <table className="label-report-table">
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Why this matters</th>
                  <th>Report</th>
                </tr>
              </thead>
              <tbody>
                {shownRows.length ? shownRows.map((row, index) => (
                  <tr key={`${row.property}-${index}`}>
                    <td>
                      <strong>{row.property}</strong>
                      <span className={`label-report-status ${row.result === 'Failed' ? 'is-failed' : 'is-passed'}`}>
                        {row.result}
                      </span>
                    </td>
                    <td>{row.why || '-'}</td>
                    <td>
                      <div className="label-report-values">
                        <span><b>Expected real PDF:</b> {row.expected || '-'}</span>
                        <span><b>Uploaded PDF:</b> {row.actual || '-'}</span>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="3">No detailed report was stored for this PDF.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function PdfPreviewModal({ pdf, onClose }) {
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewError, setPreviewError] = useState('')

  useEffect(() => {
    if (!pdf) return undefined
    if (!pdf.url) {
      setPreviewUrl('')
      setPreviewError('The original PDF is unavailable for this earlier upload.')
      return undefined
    }

    const controller = new AbortController()
    let objectUrl = ''
    setPreviewUrl('')
    setPreviewError('')

    fetch(pdf.url, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`PDF request failed (${response.status})`)
        return response.blob()
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob)
        setPreviewUrl(objectUrl)
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setPreviewError('The PDF preview could not be loaded.')
      })

    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [pdf])

  if (!pdf) return null
  return (
    <Modal title={pdf.name || 'Shipment label PDF'} onClose={onClose} width={980}>
      <div className="orders-pdf-preview">
        {!previewUrl && !previewError && <div className="orders-pdf-preview-state">Loading PDF preview...</div>}
        {previewError && <div className="orders-pdf-preview-state is-error">{previewError}</div>}
        {previewUrl && <iframe src={previewUrl} title={`Preview of ${pdf.name || 'shipment label'}`} />}
        {pdf.url && <a href={pdf.url} target="_blank" rel="noreferrer">Open PDF in a new tab</a>}
      </div>
    </Modal>
  )
}

function orderReportPath(row) {
  const reference = row.merchant_order_id || row.pa_order_id
  return reference ? `/dashboard/order-check?order=${encodeURIComponent(reference)}` : ''
}

function needsAttentionPath(row) {
  const reference = row.merchant_order_id || row.pa_order_id
  if (!reference) return '/dashboard/needs-attention'
  const encodedReference = encodeURIComponent(reference)
  return `/dashboard/needs-attention?q=${encodedReference}&open=${encodedReference}`
}

function FlaggedMerchantIndicator({ row }) {
  if (!row.merchant_is_flagged || !row.merchant_id) return null
  const rate = Number(row.merchant_success_rate)
  const threshold = Number(row.merchant_review_threshold) || 80
  return (
    <span className="orders-merchant-flag-wrap">
      <button type="button" className="orders-merchant-flag" aria-label={`Flagged merchant: ${row.merchant__merchant_name}`}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21V3" /><path className="risk-flag-cloth" d="M6 5c3.2-2.1 5.6 1.7 11-.2v8.3c-5.4 1.9-7.8-1.9-11 .2Z" /></svg>
      </button>
      <span className="orders-merchant-flag-tooltip" role="tooltip">
        <strong>Flagged merchant</strong>
        <span>{Number.isFinite(rate) ? `${rate.toFixed(1)}% success rate` : 'Performance needs review'}. Below the {threshold}% review threshold.</span>
        <Link to={`/dashboard/merchant-risk/${row.merchant_id}`}>View full details <b>→</b></Link>
      </span>
    </span>
  )
}

function FlaggedCustomerIndicator({ row }) {
  if (!row.customer_is_flagged || !row.customer_info_id) return null
  const rate = Number(row.customer_success_rate)
  const threshold = Number(row.customer_review_threshold) || 60
  return (
    <span className="orders-merchant-flag-wrap">
      <button type="button" className="orders-merchant-flag" aria-label={`Flagged customer: ${row.customer_info__customer_name}`}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21V3" /><path className="risk-flag-cloth" d="M6 5c3.2-2.1 5.6 1.7 11-.2v8.3c-5.4 1.9-7.8-1.9-11 .2Z" /></svg>
      </button>
      <span className="orders-merchant-flag-tooltip" role="tooltip">
        <strong>Flagged repeat customer</strong>
        <span>{Number.isFinite(rate) ? `${rate.toFixed(1)}% clean order rate` : 'Behaviour needs review'} — below the {threshold}% review threshold.</span>
        <Link to={`/dashboard/customer-performance/${row.customer_info_id}`}>View full details <b>→</b></Link>
      </span>
    </span>
  )
}

// Column defs double as both the table header/cell renderer and the list
// ColumnPicker offers to show/hide — keeping them in one array avoids the
// two ever drifting out of sync.
const COLUMNS = [
  {
    key: 'order_id',
    label: 'Order ID',
    render: (row) => orderReportPath(row)
      ? <Link className="orders-data-link orders-full-id-link" to={orderReportPath(row)}>{row.merchant_order_id || row.pa_order_id}</Link>
      : <span className="cell-strong">-</span>,
  },
  {
    key: 'payment_id',
    label: 'Payment ID',
    render: (row) => orderReportPath(row)
      ? <Link className="orders-data-link orders-payment-id-link" to={orderReportPath(row)}>{row.display_payment_id || row.pa_payment_id || row.phonepe_payment_id || '-'}</Link>
      : <span className="cell-strong">-</span>,
  },
  {
    key: 'awb',
    label: 'AWB',
    render: (row) => orderReportPath(row) && row.shipment_id__awb
      ? <Link className="orders-data-link" to={orderReportPath(row)}>{row.shipment_id__awb}</Link>
      : <span className="cell-strong">-</span>,
  },
  {
    key: 'merchant',
    label: 'Merchant',
    render: (row) => row.merchant_id
      ? <span className="orders-merchant-cell"><FlaggedMerchantIndicator row={row} /><Link className="merchant-history-link cell-single-line" title={row.merchant__merchant_name || '-'} to={`/dashboard/merchants/${row.merchant_id}`}>{row.merchant__merchant_name || '-'}</Link></span>
      : <span className="cell-strong cell-single-line" title={row.merchant__merchant_name || '-'}>{row.merchant__merchant_name || '-'}</span>,
  },
  {
    key: 'customer',
    label: 'Customer',
    render: (row) => <span className="orders-merchant-cell"><FlaggedCustomerIndicator row={row} /><span className="cell-single-line" title={row.customer_info__customer_name || '-'}>{row.customer_info__customer_name || '-'}</span></span>,
  },
  {
    key: 'phone',
    label: 'Phone',
    render: (row) => <span className="cell-muted cell-single-line">{row.customer_info__customer_phone || '-'}</span>,
  },
  {
    key: 'email',
    label: 'Email',
    render: (row) => (
      <span className="cell-muted order-email-cell" title={row.customer_info__customer_email || ''}>
        {row.customer_info__customer_email || '-'}
      </span>
    ),
  },
  { key: 'amount', label: 'Amount', render: (row) => <span className="cell-single-line">{formatAmount(row.order_amount)}</span> },
  {
    key: 'status',
    label: 'Payment Status',
    render: (row) => (
      <span className="table-chip-cell">
        <span className={`status-pill ${paymentStatusClass(row)}`}>
          {formatPaymentStatus(row.payment_state || row.order_status)}
        </span>
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
        <StatusPill
          value={row.shipment_id__status ? formatStatusLabel(row.shipment_id__status) : ''}
          className={`status-${(row.shipment_id__status || '').toLowerCase()}`}
        />
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
        return (
          <span className="table-chip-cell">
            <Link className="orders-status-link" to={needsAttentionPath(row)} title="Open this order in Needs Attention">
              <span className="status-pill status-not_approved">Not Approved</span>
            </Link>
          </span>
        )
      }
      if (row.shipment_label_status === 'shipment_linked') {
        return <span className="table-chip-cell"><span className="status-pill status-approved">Approved</span></span>
      }
      return (
        <span className="table-chip-cell">
          <Link className="orders-status-link" to={needsAttentionPath(row)} title="Open this order in Needs Attention">
            <span className="status-pill status-missing">Yet to Upload</span>
          </Link>
        </span>
      )
    },
  },
  {
    key: 'merchant_issue',
    label: 'Merchant Issue Status',
    render: (row) => row.merchant_issue ? (
      <Link
        className="orders-issue-status-link"
        to={`/dashboard/merchant-issues?q=${encodeURIComponent(row.merchant_issue.reference)}&chat=${row.merchant_issue.id}`}
        title={`Open ${row.merchant_issue.reference} conversation`}
      >
        <span className={`status-pill ${issueStatusClass(row.merchant_issue.status)}`}>
          {formatStatusLabel(row.merchant_issue.status)}
        </span>
      </Link>
    ) : <span className="cell-muted">-</span>,
  },
  {
    key: 'customer_issue',
    label: 'Customer Issue Status',
    render: (row) => row.customer_issue ? (
      <Link
        className="orders-issue-status-link"
        to={`/dashboard/customer-issues?q=${encodeURIComponent(row.customer_issue.reference)}&chat=${row.customer_issue.id}`}
        title={`Open ${row.customer_issue.reference} conversation`}
      >
        <span className={`status-pill ${issueStatusClass(row.customer_issue.status)}`}>
          {formatStatusLabel(row.customer_issue.status)}
        </span>
      </Link>
    ) : <span className="cell-muted">-</span>,
  },
  {
    key: 'shipment_label_pdf',
    label: 'PDF Name',
    render: (row, { openPdfPreview } = {}) => {
      const hasLabel = ['approved', 'not_approved'].includes(row.shipment_label_status)
      if (!hasLabel || !row.shipment_label_file_name) return <span className="cell-muted">-</span>
      return (
        <button
          type="button"
          className="table-action-link orders-pdf-button"
          onClick={() => openPdfPreview?.({ url: row.shipment_label_pdf_url, name: row.shipment_label_file_name })}
          title={`Preview ${row.shipment_label_file_name}`}
        >
          View PDF
        </button>
      )
    },
  },
  {
    key: 'shipment_label_reason',
    label: 'Reason',
    render: (row, { openLabelReport } = {}) => {
      if (row.shipment_label_status === 'approved') {
        return <span className="cell-muted">-</span>
      }
      if (row.shipment_label_status === 'not_approved' && row.shipment_label_report) {
        return (
          <button type="button" className="table-action-link label-report-link" onClick={() => openLabelReport(row.shipment_label_report)}>
            View report
          </button>
        )
      }
      return (
        <span className="cell-muted order-reason-cell" title={row.shipment_label_reason || ''}>
          {row.shipment_label_reason || '-'}
        </span>
      )
    },
  },
  {
    key: 'date',
    label: 'Date',
    render: (row) => (
      <span className="cell-muted">{formatDateOnly(row.order_date)}</span>
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

export default function OrdersPage({ completedOnly = false }) {
  const [rows, setRows] = useState([])
  const [merchants, setMerchants] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  // /dashboard/<page>?q=... opens the page already searched (used by the top-bar search).
  const [searchParams] = useSearchParams()
  const [q, setQ] = useState(searchParams.get('q') || '')
  const [filters, setFilters] = useState({
    merchantId: '',
    dateFrom: '',
    dateTo: '',
    courier: '',
    deliveryStatus: '',
    shipmentLabelStatus: '',
    rowTone: '',
    sortOrder: 'newest',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [labelReport, setLabelReport] = useState(null)
  const [pdfPreview, setPdfPreview] = useState(null)
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
        limit: PAGE_SIZE,
        merchant_id: filters.merchantId,
        date_from: filters.dateFrom,
        date_to: filters.dateTo,
        courier: filters.courier,
        delivery_status: filters.deliveryStatus,
        shipment_label_status: filters.shipmentLabelStatus,
        row_tone: filters.rowTone,
        scope: completedOnly ? 'completed' : 'all',
        sort: filters.sortOrder,
      })
      .then((data) => {
        setRows(data.results)
        setTotalPages(data.total_pages)
        setTotal(data.total)
        setError('')
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [page, q, filters, completedOnly])

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
      rowTone: '',
      sortOrder: 'newest',
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
            {completedOnly ? 'Completed & resolved orders' : 'Order details'}
          </div>
        </div>
        <form className="toolbar orders-toolbar orders-filter-panel" onSubmit={handleSearch}>
          <div className="toolbar-field">
            <label htmlFor="search">Search orders:</label>
            <input id="search" name="search" placeholder="order id, customer name, merchant…" defaultValue={q} />
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
              className="orders-date-input"
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
            />
          </div>
          <div className="toolbar-field">
            <label htmlFor="date-to">To date:</label>
            <input
              id="date-to"
              className="orders-date-input"
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
          <div className="toolbar-field">
            <label htmlFor="sort-order">Sort:</label>
            <select
              id="sort-order"
              value={filters.sortOrder}
              onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
          <div className="toolbar-field">
            <label htmlFor="row-colour">Row colour:</label>
            <select
              id="row-colour"
              value={filters.rowTone}
              onChange={(event) => handleFilterChange('rowTone', event.target.value)}
            >
              {ROW_TONE_FILTERS.filter((tone) => (
                !completedOnly || ['', 'success', 'resolved'].includes(tone.value)
              )).map((tone) => (
                <option key={tone.value || 'all'} value={tone.value}>{tone.label}</option>
              ))}
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

      <div className="orders-row-legend orders-row-legend-bar" aria-label="Order row colour guide">
        <span className="is-success">Successful delivery</span>
        {!completedOnly && <span className="is-pending">Ongoing</span>}
        {!completedOnly && <span className="is-failed">Failed / new issue</span>}
        <span className="is-resolved">Issues resolved</span>
      </div>

      <div className="section-title table-section-title">
        <div className="section-title-left">
          <span className="orders-section-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M6.5 3.5h11A2.5 2.5 0 0 1 20 6v12a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18V6a2.5 2.5 0 0 1 2.5-2.5Zm2 4a1 1 0 0 0 0 2h7a1 1 0 1 0 0-2h-7Zm0 3.5a1 1 0 1 0 0 2h7a1 1 0 1 0 0-2h-7Zm0 3.5a1 1 0 1 0 0 2h4.5a1 1 0 1 0 0-2H8.5Z" />
            </svg>
          </span>
          {completedOnly ? 'Completed order archive' : 'Order details'}
        </div>
      </div>

      <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {visibleColumns.map((col) => (
                  <th key={col.key} className={`orders-col-${col.key}`}>{col.label}</th>
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
                  <td colSpan={visibleColumns.length || 1} className="empty-row">
                    {completedOnly ? 'No completed or resolved orders found.' : 'No orders found.'}
                  </td>
                </tr>
              ) : visibleColumns.length === 0 ? (
                <tr>
                  <td className="empty-row">No columns selected.</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr className={`orders-state-row is-${orderRowTone(row)}`} key={row.id}>
                    {visibleColumns.map((col) => (
                      <td key={col.key} className={`orders-col-${col.key}`}>{col.render(row, { openLabelReport: setLabelReport, openPdfPreview: setPdfPreview })}</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
      </div>

      <div className="orders-pagination">
          <span className="orders-pagination-summary">
            Showing {rows.length} of {total} {completedOnly ? 'completed or resolved' : 'payment'} orders.
          </span>
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
      <LabelReportModal report={labelReport} onClose={() => setLabelReport(null)} />
      <PdfPreviewModal pdf={pdfPreview} onClose={() => setPdfPreview(null)} />
    </div>
  )
}
