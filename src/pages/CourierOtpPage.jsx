import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

const statusClass = {
  OTP_VERIFIED: 'status-success',
  OTP_FIELD_PRESENT: 'status-pending',
  CODE_FIELD_PRESENT: 'status-pending',
  CODE_VERIFIED: 'status-success',
  NON_OTP_DELIVERED: 'status-failed',
  UNKNOWN: 'status-pending',
  FETCH_FAILED: 'status-failed',
  VERIFIED: 'status-success',
  NOT_VERIFIED: 'status-failed',
}

function formatStatus(value) {
  return value ? value.replaceAll('_', ' ') : '-'
}

function formatOtpStatus(value) {
  if (value === 'OTP_VERIFIED' || value === 'CODE_VERIFIED') return 'Verified'
  if (value === 'OTP_FIELD_PRESENT' || value === 'CODE_FIELD_PRESENT') return 'Not verified (field present)'
  if (value === 'FETCH_FAILED') return 'Could not verify'
  return 'Not verified'
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '-'
}

function formatFieldLabel(path) {
  const label = (path || '').split('.').pop().replace(/\[\d+\]/g, '').replaceAll('_', ' ').trim()
  return label.replace(/\b\w/g, (character) => character.toUpperCase()) || 'Tracking Field'
}

function Field({ label, value }) {
  return (
    <div className="otp-result-item">
      <span>{label}</span>
      <strong>{value || value === 0 ? value : '-'}</strong>
    </div>
  )
}

export default function CourierOtpPage({
  courierName,
  pageTitle,
  awbLabel,
  checkButtonLabel,
  checkOtp,
  saveVerificationDecision,
  emptyMessage,
  statusLabel = 'OTP Status',
  publicEndpointNote,
  showCarrierSummary = true,
  showAllCarrierFields = true,
  showHttpStatus = true,
  showOtpStatus = true,
  showCourierStatus = true,
  showStatusTime = true,
  statusTimeLabel = 'Status Time',
  showReturnedFieldsAsCards = false,
  showTrackingDetails = true,
}) {
  const [searchParams] = useSearchParams()
  const initialAwb = searchParams.get('awb') || ''
  const [awb, setAwb] = useState(initialAwb)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [decisionSaving, setDecisionSaving] = useState('')

  async function runCheck(value) {
    const awbToCheck = value.trim()
    if (!awbToCheck) return

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const data = await checkOtp(awbToCheck)
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (initialAwb) runCheck(initialAwb)
    // Run once when another page passes an AWB in the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(event) {
    event.preventDefault()
    await runCheck(awb)
  }

  async function saveDecision(decision) {
    if (!result?.awb) return

    setDecisionSaving(decision)
    setError('')
    try {
      const manualDecision = await saveVerificationDecision(result.awb, decision, result.id)
      setResult((current) => ({
        ...current,
        manual_decision: manualDecision,
      }))
    } catch (err) {
      setError(err.message)
    } finally {
      setDecisionSaving('')
    }
  }

  const extraFields = result?.tracking_summary?.extra_fields || {}
  const allCarrierFields = result?.tracking_summary?.fields || []
  const meaningfulCarrierFields = result?.tracking_summary?.meaningful_fields || []
  const returnedCarrierFields = meaningfulCarrierFields.length > 0
    ? meaningfulCarrierFields
    : allCarrierFields
      .filter((field) => field?.value && !/^(html|page_text|source_url|content_type)$/i.test(field.path || ''))
      .slice(0, 40)
  const displayCarrierFields = returnedCarrierFields.filter((field) => {
    const path = field.path || ''
    return /origin|destination|last.?location|reference|booking.?date|pickup.?date|delivery.?date|consignee|recipient|product.?type|weight|pieces|from|to/i.test(path)
  })

  return (
    <div>
      <h1>{pageTitle || `SecurePay - ${courierName} OTP Check`}</h1>

      <div className="panel-card">
        <form className="toolbar" onSubmit={handleSubmit}>
          <div className="toolbar-field awb-field">
            <label htmlFor="awb">{awbLabel || `${courierName} AWB:`}</label>
            <input
              id="awb"
              name="awb"
              value={awb}
              onChange={(event) => setAwb(event.target.value)}
              placeholder="Enter AWB number"
              autoComplete="off"
            />
          </div>
          <button type="submit" disabled={loading || !awb.trim()}>
            {loading ? 'Checking...' : checkButtonLabel || 'Check OTP'}
          </button>
        </form>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="panel-card">
        <div className="section-title">
          <div className="section-title-left">Verification Result</div>
        </div>

        {!result ? (
          <div className="empty-row">{emptyMessage}</div>
        ) : (
          <>
            <div className="otp-result-grid">
              <Field label="AWB" value={result.awb} />
              <Field label="Provider" value={result.provider || result.courier} />
              {showHttpStatus && <Field label="HTTP Status" value={result.http_status} />}
              {showOtpStatus && (
                <div className="otp-result-item">
                  <span>{statusLabel}</span>
                  <strong>
                    <span className={`status-pill ${statusClass[result.otp_status] || ''}`}>
                      {formatOtpStatus(result.otp_status)}
                    </span>
                  </strong>
                </div>
              )}
              <Field label="Delivery Status" value={formatStatus(result.delivery_status)} />
              {!showCarrierSummary && !showCourierStatus && showStatusTime && result.tracking_summary && (
                <Field label={statusTimeLabel} value={result.tracking_summary.status_time} />
              )}
            </div>
            {showOtpStatus && result.otp_status === 'UNKNOWN' && publicEndpointNote && (
              <div className="info-banner">{publicEndpointNote}</div>
            )}
          </>
        )}

        {result?.tracking_summary && showCarrierSummary && (
          <>
            <div className="section-title otp-subsection-title">
              <div className="section-title-left">Carrier Fields</div>
            </div>
            <div className="otp-result-grid">
              <Field label="HQ Status" value={result.tracking_summary.hq_status} />
              <Field label="Status" value={result.tracking_summary.status} />
              <Field label="Status Type" value={result.tracking_summary.status_type} />
              <Field label="Status Time" value={formatDate(result.tracking_summary.status_datetime)} />
              <Field label="Instructions" value={result.tracking_summary.instructions} />
              <Field label="Delivery Date Text" value={result.tracking_summary.delivery_date_label} />
              <Field label="Product Type" value={result.tracking_summary.product_type} />
              <Field label="Flow" value={result.tracking_summary.current_flow} />
              <Field label="Reference No" value={result.tracking_summary.reference_no} />
              <Field label="Scan Count" value={result.tracking_summary.scan_count} />
              <Field label="Pickup Date" value={extraFields.pickup_date} />
              <Field label="From" value={extraFields.from} />
              <Field label="To" value={extraFields.to} />
              <Field label="Recipient" value={extraFields.recipient} />
            </div>
          </>
        )}

        {showTrackingDetails && showReturnedFieldsAsCards && displayCarrierFields.length > 0 && (
          <div className="otp-result-grid otp-returned-fields-grid">
            {displayCarrierFields.map((field, index) => (
              <Field
                key={`${field.path}-${index}`}
                label={formatFieldLabel(field.path)}
                value={field.value}
              />
            ))}
          </div>
        )}

        {showTrackingDetails && !showReturnedFieldsAsCards && returnedCarrierFields.length > 0 && (
          <div className="table-wrap otp-evidence-table">
            <div className="section-title otp-subsection-title">
              <div className="section-title-left">Tracking Details</div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {returnedCarrierFields.map((field, index) => (
                  <tr key={`${field.path}-${index}`}>
                    <td className="cell-muted">{field.path || '-'}</td>
                    <td>{field.value || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {result?.tracking_summary && !showCarrierSummary && showCourierStatus && (
          <div className="otp-result-grid">
            <Field label="Courier Status" value={result.tracking_summary.courier_status || result.tracking_summary.status} />
            {showStatusTime && <Field label={statusTimeLabel} value={result.tracking_summary.status_time} />}
          </div>
        )}

        {result?.error && <div className="error-banner">{result.error}</div>}

        {result?.tracking_summary?.scans?.length > 0 && (
          <div className="table-wrap otp-evidence-table">
            <table>
              <thead>
                <tr>
                  <th>State</th>
                  <th>Scan</th>
                  <th>Remark</th>
                  <th>Type</th>
                  <th>City</th>
                  <th>Location</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {result.tracking_summary.scans.map((scan, index) => (
                  <tr key={`${scan.scan}-${index}`}>
                    <td className="cell-strong">{scan.state_label || '-'}</td>
                    <td>{scan.scan || '-'}</td>
                    <td>{scan.scan_nsl_remark || '-'}</td>
                    <td className="cell-muted">{scan.scan_type || '-'}</td>
                    <td className="cell-muted">{scan.city_location || '-'}</td>
                    <td className="cell-muted">{scan.scanned_location || '-'}</td>
                    <td className="cell-muted">{formatDate(scan.scan_date_time)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showAllCarrierFields && allCarrierFields.length > 0 && (
          <div className="table-wrap otp-evidence-table">
            <div className="section-title otp-subsection-title">
              <div className="section-title-left">All Returned Carrier Fields</div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {allCarrierFields.map((field, index) => (
                  <tr key={`${field.path}-${index}`}>
                    <td className="cell-muted">{field.path || '-'}</td>
                    <td>{field.value || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {result && !result.error && saveVerificationDecision && (
          <div className="verification-actions">
            <div className="manual-decision">
              {result.manual_decision ? (
                <span className={`status-pill ${statusClass[result.manual_decision.decision] || ''}`}>
                  {formatStatus(result.manual_decision.decision)}
                </span>
              ) : (
                <span className="cell-muted">No final decision saved</span>
              )}
            </div>
            <button
              type="button"
              className="decision-button decision-not-verified"
              disabled={!!decisionSaving}
              onClick={() => saveDecision('NOT_VERIFIED')}
            >
              {decisionSaving === 'NOT_VERIFIED' ? 'Saving...' : 'Not Verified'}
            </button>
            <button
              type="button"
              className="decision-button decision-verified"
              disabled={!!decisionSaving}
              onClick={() => saveDecision('VERIFIED')}
            >
              {decisionSaving === 'VERIFIED' ? 'Saving...' : 'Verified'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
