import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
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

function AttentionCourierLogo({ courier }) {
  const normalized = normalizeCourierName(courier)
  const match = courierLogos.find((item) => item.keys.some((key) => {
    const normalizedKey = normalizeCourierName(key)
    return normalized === normalizedKey || normalized.includes(normalizedKey)
  }))

  if (!courier) return '-'
  if (!match) return courier
  return (
    <span className={`courier-logo-cell courier-logo-${normalizeCourierName(match.label).replaceAll(' ', '-')}`} title={courier}>
      <img src={match.logo} alt={`${match.label} logo`} />
    </span>
  )
}

function pretty(value) {
  if (value === 'MANUAL_REVIEW' || value === 'UNDER_REVIEW') return 'Needs Review'
  return String(value || '-')
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function badgeClass(value) {
  const normalized = String(value || '').toUpperCase()
  if (['APPROVED', 'VERIFIED', 'DELIVERED', 'COMPLETED', 'RELEASE', 'REFUND', 'SENT'].includes(normalized)) return 'status-pill status-success'
  if (['NOT_APPROVED', 'NOT_VERIFIED', 'FAILED', 'REJECTED', 'DANGER'].includes(normalized)) return 'status-pill status-failed'
  return 'status-pill status-pending'
}

function attentionStatusValue(row) {
  const pdfStatus = String(row.pdf_status || '').toUpperCase()
  if (['NOT_FOUND', 'NOT_UPLOADED'].includes(pdfStatus)) return 'WAITING_FOR_UPLOAD'
  return row.decision_state || row.action_status
}

function pdfIssueText(row) {
  const status = String(row.pdf_status || '').toUpperCase()
  if (['NOT_FOUND', 'NOT_UPLOADED'].includes(status)) return 'The shipment-label PDF has not been uploaded.'
  if (['NOT_APPROVED', 'REJECTED'].includes(status)) return 'The uploaded shipment-label PDF was not approved and must be corrected.'
  if (status === 'PROCESSING') return 'The shipment-label PDF is still awaiting review.'
  return `The shipment-label PDF currently has the status ${pretty(row.pdf_status)}.`
}

function merchantIssueMailto(row) {
  if (!row.merchant_email) return ''
  const orderReference = row.order_id || row.pa_order_id || 'Unknown'
  const paymentReference = row.pa_payment_id || 'Not available'
  const awb = row.awb || 'Not available'
  const body = [
    `Hello ${row.merchant_name || 'Merchant'},`,
    '',
    'Action is required for the shipment document on the order below:',
    '',
    `Issue: ${pdfIssueText(row)}`,
    `Order ID: ${orderReference}`,
    `Payment ID: ${paymentReference}`,
    `AWB: ${awb}`,
    `Shipment status: ${pretty(row.courier_status)}`,
    '',
    'Please upload the missing document or replace the rejected document so the order can be reviewed.',
    '',
    'Thank you.',
  ].join('\n')
  return `mailto:${row.merchant_email}?subject=${encodeURIComponent(`Shipment document required for order ${orderReference}`)}&body=${encodeURIComponent(body)}`
}

function merchantDecisionMailto(row) {
  if (!row.merchant_email) return ''
  const orderReference = row.order_id || row.pa_order_id || 'Unknown'
  const pdfStatus = String(row.pdf_status || '').toUpperCase()
  const shipmentStatus = String(row.courier_status || '').toUpperCase()
  const requestedActions = []

  if (['NOT_FOUND', 'NOT_UPLOADED'].includes(pdfStatus)) {
    requestedActions.push('Upload the shipment-label PDF for this order.')
  } else if (['NOT_APPROVED', 'REJECTED'].includes(pdfStatus)) {
    requestedActions.push('Upload a clear and valid replacement shipment-label PDF because the current document was not approved.')
  } else if (pdfStatus === 'PROCESSING') {
    requestedActions.push('Confirm that the uploaded shipment-label PDF is the final and correct document.')
  }

  if (['PENDING', 'NOT_VERIFIED', 'NOT_AVAILABLE'].includes(shipmentStatus)) {
    requestedActions.push(`Confirm the courier and AWB details and provide the latest shipment update. Current shipment status: ${pretty(row.courier_status)}.`)
  }

  if (requestedActions.length === 0) {
    requestedActions.push('Review this order and reply with the information required to complete processing.')
  }

  const body = [
    `Hello ${row.merchant_name || 'Merchant'},`,
    '',
    `We need your assistance to continue processing order ${orderReference}.`,
    '',
    'Action required:',
    ...requestedActions.map((action) => `- ${action}`),
    '',
    'Order details:',
    `Order ID: ${orderReference}`,
    `Payment ID: ${row.pa_payment_id || 'Not available'}`,
    `AWB: ${row.awb || 'Not available'}`,
    `PDF status: ${pretty(row.pdf_status)}`,
    `Shipment status: ${pretty(row.courier_status)}`,
    '',
    'Please complete the requested action and reply to this email once it has been updated.',
    '',
    'Regards,',
    'Escrosafe',
  ].join('\n')
  return `mailto:${row.merchant_email}?subject=${encodeURIComponent(`Action required for order ${orderReference}`)}&body=${encodeURIComponent(body)}`
}

function actionableStatusMailto(row) {
  const status = String(attentionStatusValue(row) || '').toUpperCase()
  if (!status || ['APPROVED', 'VERIFIED', 'COMPLETED', 'RELEASE', 'REFUND'].includes(status)) return ''
  if (status === 'WAITING_FOR_UPLOAD') return merchantIssueMailto(row)
  return merchantDecisionMailto(row)
}

function courierCheckFor(courier) {
  const normalized = normalizeCourierName(courier)
  if (normalized.includes('delhivery')) return api.checkDelhiveryOtp
  if (normalized.includes('dhl') && normalized.includes('blue dart')) return api.checkDhlBlueDartOtp
  if (normalized.includes('blue dart') || normalized.includes('bluedart')) return api.checkBlueDartOtp
  if (normalized.includes('xpressbees') || normalized.includes('xpress bees')) return api.checkXpressbeesOtp
  if (normalized.includes('dtdc')) return api.checkDtdcOtp
  if (normalized.includes('shiprocket')) return api.checkShiprocketOtp
  if (normalized.includes('ekart')) return api.checkEkartOtp
  if (normalized.includes('shadowfax') || normalized.includes('shadow fax')) return api.checkShadowfaxOtp
  return null
}

function latestCourierDecision(result, fallback) {
  return result?.manual_decision?.decision || fallback || 'PENDING'
}

function courierEvidenceSummary(result) {
  const deliveryStatus = result?.delivery_status
    || result?.tracking_summary?.courier_status
    || result?.tracking_summary?.status
    || result?.tracking_summary?.hq_status
  const otpStatus = result?.otp_status
  const details = []
  if (deliveryStatus) details.push(`carrier status is ${pretty(deliveryStatus)}`)
  if (otpStatus && otpStatus !== 'UNKNOWN') details.push(`verification evidence is ${pretty(otpStatus)}`)
  return details.length ? details.join(' and ') : 'the carrier returned no newer verification information'
}

function pdfDecisionKey(row, decision) {
  return `${row.vaultpay_order_id || row.order_id || row.pa_order_id}:${decision}`
}

function formatDetailDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('en-IN')
}

function formatDetailAmount(value, currency = 'INR') {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '-'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency || 'INR',
    maximumFractionDigits: 2,
  }).format(amount)
}

function AttentionDetail({ label, children }) {
  return (
    <div className="attention-detail-field">
      <span>{label}</span>
      <div className="attention-detail-value">{children || '-'}</div>
    </div>
  )
}

function AttentionStatus({ value, onClick, href, title, disabled = false }) {
  if (!value) return '-'
  const chip = <span className={badgeClass(value)}>{pretty(value)}</span>
  if (href) {
    return <a className="attention-status-action" href={href} title={title}>{chip}</a>
  }
  if (onClick) {
    return <button type="button" className="attention-status-action" onClick={onClick} title={title} disabled={disabled}>{chip}</button>
  }
  return chip
}

function AttentionDetailsModal({ row, onClose }) {
  const isMissingLabel = row.type === 'missing_label'
  const actionTitle = isMissingLabel ? 'Shipment label upload is required' : 'Admin review is required'
  const actionCopy = isMissingLabel
    ? `Contact ${row.merchant_name || 'the merchant'} and ask them to upload the shipment label.`
    : row.message || 'Review the payment, PDF, and shipment evidence before making the release or refund decision.'
  const primaryMailto = isMissingLabel ? merchantIssueMailto(row) : merchantDecisionMailto(row)
  const pdfStatus = String(row.pdf_status || '').toUpperCase()
  const pdfNeedsMerchant = Boolean(row.pdf_status) && !['APPROVED', 'VERIFIED', 'COMPLETED'].includes(pdfStatus)
  const pdfMailto = pdfNeedsMerchant ? merchantIssueMailto(row) : ''
  return (
    <Modal title={`Attention: ${row.title || 'Item details'}`} onClose={onClose} width={760}>
      <div className="attention-detail-modal">
        <div className="attention-action-summary">
          <span className="attention-action-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M12 3 2.5 20h19L12 3Zm0 6v5m0 3v.01" /></svg>
          </span>
          <div className="attention-action-copy">
            <span>Action required</span>
            <strong>{actionTitle}</strong>
            <p>{actionCopy}</p>
          </div>
          {primaryMailto ? (
            <a className="attention-email-action" href={primaryMailto}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18v14H3V5Zm1 1 8 7 8-7" /></svg>
              Email merchant
            </a>
          ) : null}
        </div>

        <section className="attention-detail-section">
          <h4>Order and payment</h4>
          <div className="attention-detail-grid">
            <AttentionDetail label="Order ID">
              {row.order_id || row.pa_order_id}
            </AttentionDetail>
            <AttentionDetail label="Payment ID">
              {row.pa_payment_id}
            </AttentionDetail>
            <AttentionDetail label="Amount">{formatDetailAmount(row.amount, row.currency)}</AttentionDetail>
            <AttentionDetail label="Order date">{formatDetailDate(row.created_at)}</AttentionDetail>
          </div>
        </section>

        <section className="attention-detail-section">
          <h4>Merchant and customer</h4>
          <div className="attention-detail-grid">
            <AttentionDetail label="Merchant">{row.merchant_id ? <Link className="merchant-history-link" to={`/dashboard/merchants/${row.merchant_id}`}>{row.merchant_name}</Link> : row.merchant_name}</AttentionDetail>
            <AttentionDetail label="Customer">{row.customer_name}</AttentionDetail>
          </div>
        </section>

        <section className="attention-detail-section">
          <h4>{isMissingLabel ? 'Shipment document' : 'Shipment and verification'}</h4>
          <div className="attention-detail-grid">
            {!isMissingLabel ? <AttentionDetail label="AWB number">{row.awb}</AttentionDetail> : null}
            {!isMissingLabel ? <AttentionDetail label="Courier"><AttentionCourierLogo courier={row.courier} /></AttentionDetail> : null}
            <AttentionDetail label="PDF status">
              <AttentionStatus
                value={row.pdf_status}
                href={pdfMailto}
                title={pdfMailto ? `Email merchant about the ${pretty(row.pdf_status)} PDF status` : ''}
              />
            </AttentionDetail>
          </div>
        </section>
        </div>
    </Modal>
  )
}

export default function NeedsAttentionPage() {
  const [searchParams] = useSearchParams()
  const pageSize = 25
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [actingPdf, setActingPdf] = useState('')
  const [checkingCourier, setCheckingCourier] = useState('')
  const [openPdfActions, setOpenPdfActions] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(null)
  const [selectedRow, setSelectedRow] = useState(null)
  const [q, setQ] = useState(searchParams.get('q') || '')
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({ type: '', pdfStatus: '', courierStatus: '', sortOrder: 'newest' })

  const load = useCallback((options = {}) => {
    setLoading(true)
    setError('')
    api
      .needsAttention({ q, sync: options.sync ? '1' : '', sort: filters.sortOrder })
      .then((data) => setRows(data.results || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [q, filters.sortOrder])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const requestedId = searchParams.get('open')
    if (!requestedId || rows.length === 0) return
    const requestedRow = rows.find((row) => [
      row.id,
      row.order_id,
      row.pa_order_id,
      row.pa_payment_id,
    ].some((value) => value && String(value) === requestedId))
    if (requestedRow) setSelectedRow(requestedRow)
  }, [rows, searchParams])

  useEffect(() => {
    if (!success) return undefined
    const timer = window.setTimeout(() => setSuccess(null), 4500)
    return () => window.clearTimeout(timer)
  }, [success])

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
    const decisionReference = row.vaultpay_order_id || row.order_id || row.pa_order_id
    if (!decisionReference) return

    setError('')
    setSuccess(null)
    setActingPdf(`${decisionReference}:${decision}`)
    try {
      const result = await api.decideNeedsAttentionPdf(decisionReference, decision)
      setSelectedRow((current) => current?.id === row.id
        ? {
            ...current,
            pdf_status: decision,
            decision_state: result?.order?.decision_state || current.decision_state,
          }
        : current)
      setSuccess({
        message: `PDF check marked ${pretty(decision)} for ${row.order_id}. PA decision has been re-evaluated.`,
        tone: decision === 'NOT_APPROVED' ? 'danger' : 'success',
      })
      setOpenPdfActions('')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setActingPdf('')
    }
  }

  async function checkCourierVerification(row) {
    if (!row.awb) {
      setSuccess({
        message: `Shipment status cannot be refreshed for ${row.order_id || 'this order'} because no AWB is available.`,
        tone: 'danger',
      })
      return
    }

    const runCourierCheck = courierCheckFor(row.courier)
    if (!runCourierCheck) {
      setSuccess({
        message: `No supported courier check is available for ${row.courier || 'this order'}. The current shipment status remains ${pretty(row.courier_status)}.`,
        tone: 'danger',
      })
      return
    }

    setError('')
    setSuccess(null)
    setCheckingCourier(row.id)
    try {
      const result = await runCourierCheck(row.awb)
      if (result?.error) throw new Error(result.error)

      const previousStatus = String(row.courier_status || 'PENDING').toUpperCase()
      const latestStatus = String(latestCourierDecision(result, previousStatus)).toUpperCase()
      const evidence = courierEvidenceSummary(result)

      if (latestStatus !== previousStatus) {
        setRows((current) => current.map((item) => item.id === row.id ? { ...item, courier_status: latestStatus } : item))
        setSelectedRow((current) => current?.id === row.id ? { ...current, courier_status: latestStatus } : current)
        setSuccess({
          message: `Shipment status updated from ${pretty(previousStatus)} to ${pretty(latestStatus)}; ${evidence}.`,
          tone: latestStatus === 'NOT_VERIFIED' ? 'danger' : 'success',
        })
      } else {
        setSuccess({
          message: `No newer shipment status is available. Status remains ${pretty(previousStatus)}; ${evidence}.`,
          tone: 'info',
        })
      }
    } catch (err) {
      setSuccess({
        message: `Shipment status could not be refreshed: ${err.message}`,
        tone: 'danger',
      })
    } finally {
      setCheckingCourier('')
    }
  }

  function clearFilters() {
    setQ('')
    setFilters({ type: '', pdfStatus: '', courierStatus: '', sortOrder: 'newest' })
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
          <div className="toolbar-field">
            <label htmlFor="needs-sort-order">Sort:</label>
            <select id="needs-sort-order" value={filters.sortOrder} onChange={(event) => { setFilters((current) => ({ ...current, sortOrder: event.target.value })); setPage(1) }}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
          <button type="button" onClick={() => load({ sync: true })}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          <button type="button" onClick={clearFilters}>Clear</button>
        </form>

        {error ? <div className="error-banner">{error}</div> : null}
        {success ? (
          <div className={`needs-toast needs-toast-${success.tone}`} role="status" aria-live="polite">
            <span>{success.message}</span>
            <button type="button" aria-label="Close notification" onClick={() => setSuccess(null)}>
              ×
            </button>
          </div>
        ) : null}

        <div className="table-wrap needs-attention-table-wrap">
          <table className="needs-attention-table">
            <thead>
              <tr>
                <th>Issue</th>
                <th>Cause</th>
                <th>Merchant</th>
                <th>Order</th>
                <th>Payment ID</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>PDF</th>
                <th>Courier</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="empty-row">Loading...</td></tr>
              ) : filteredRows.length === 0 ? (
                <tr><td colSpan={10} className="empty-row">No items need attention.</td></tr>
              ) : visibleRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="cell-strong">{row.title}</div>
                  </td>
                  <td>
                    <div className="cell-muted needs-message">{row.message}</div>
                  </td>
                  <td>
                    {row.merchant_id ? <Link className="merchant-history-link" to={`/dashboard/merchants/${row.merchant_id}`}>{row.merchant_name || '-'}</Link> : <div className="cell-strong">{row.merchant_name || '-'}</div>}
                  </td>
                  <td>
                    {row.order_id || row.pa_order_id ? (
                      <button type="button" className="needs-id-link needs-id-button" onClick={() => setSelectedRow(row)}>
                        {row.order_id || row.pa_order_id}
                      </button>
                    ) : <span className="cell-strong">-</span>}
                  </td>
                  <td>
                    {row.pa_payment_id ? (
                      <button type="button" className="needs-id-link needs-id-button" onClick={() => setSelectedRow(row)}>
                        {row.pa_payment_id}
                      </button>
                    ) : <span className="cell-strong">-</span>}
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
                            if (row.can_decide && ['NOT_FOUND', 'NOT_APPROVED', 'PROCESSING'].includes(row.pdf_status)) {
                              setOpenPdfActions((current) => (current === row.id ? '' : row.id))
                            } else if (row.pdf_status === 'NOT_FOUND') {
                              setSelectedRow(row)
                            }
                          }}
                          disabled={row.pdf_status !== 'NOT_FOUND' && (!row.can_decide || !['NOT_APPROVED', 'PROCESSING'].includes(row.pdf_status))}
                        >
                          {pretty(row.pdf_status)}
                        </button>
                        {row.can_decide && ['NOT_FOUND', 'NOT_APPROVED', 'PROCESSING'].includes(row.pdf_status) && openPdfActions === row.id ? (
                          <div className="needs-pdf-actions">
                            <button
                              type="button"
                              onClick={() => decidePdf(row, 'APPROVED')}
                              disabled={Boolean(actingPdf)}
                            >
                              {actingPdf === pdfDecisionKey(row, 'APPROVED') ? 'Saving...' : 'Approve'}
                            </button>
                            <button
                              type="button"
                              onClick={() => decidePdf(row, 'NOT_APPROVED')}
                              disabled={Boolean(actingPdf)}
                            >
                              {actingPdf === pdfDecisionKey(row, 'NOT_APPROVED') ? 'Saving...' : 'Not Approved'}
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
                      <button
                        type="button"
                        className="attention-status-action needs-table-status-action"
                        onClick={() => checkCourierVerification(row)}
                        disabled={checkingCourier === row.id}
                        title="Check the latest shipment status from the backend"
                      >
                        <span className={badgeClass(checkingCourier === row.id ? 'CHECKING' : row.courier_status)}>
                          {pretty(checkingCourier === row.id ? 'CHECKING' : row.courier_status)}
                        </span>
                      </button>
                    ) : (
                      <span className="cell-muted">-</span>
                    )}
                  </td>
                  <td>
                    {actionableStatusMailto(row) ? (
                      <a
                        className="attention-status-action needs-table-status-action"
                        href={actionableStatusMailto(row)}
                        title={`Email merchant about the ${pretty(attentionStatusValue(row))} status`}
                      >
                        <span className={badgeClass(attentionStatusValue(row))}>{pretty(attentionStatusValue(row))}</span>
                      </a>
                    ) : (
                      <span className={badgeClass(attentionStatusValue(row))}>
                        {pretty(attentionStatusValue(row))}
                      </span>
                    )}
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
      {selectedRow ? (
        <AttentionDetailsModal
          row={selectedRow}
          onClose={() => setSelectedRow(null)}
        />
      ) : null}
    </div>
  )
}
