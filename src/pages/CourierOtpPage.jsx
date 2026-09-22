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

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '-'
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
  const rawResponse = result?.raw_response

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
              <Field label="HTTP Status" value={result.http_status} />
              <div className="otp-result-item">
                <span>{statusLabel}</span>
                <strong>
                  <span className={`status-pill ${statusClass[result.otp_status] || ''}`}>
                    {formatStatus(result.otp_status)}
                  </span>
                </strong>
              </div>
              <Field label="Delivery Status" value={formatStatus(result.delivery_status)} />
            </div>
            {result.otp_status === 'UNKNOWN' && publicEndpointNote && (
              <div className="info-banner">{publicEndpointNote}</div>
            )}
          </>
        )}

        {result?.tracking_summary && (
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

        {result?.error && <div className="error-banner">{result.error}</div>}

        {result?.evidence?.length > 0 && (
          <div className="table-wrap otp-evidence-table">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Carrier Value</th>
                </tr>
              </thead>
              <tbody>
                {result.evidence.map((item, index) => (
                  <tr key={`${item.path}-${index}`}>
                    <td>
                      <span className={`status-pill ${statusClass[item.type] || ''}`}>
                        {formatStatus(item.type)}
                      </span>
                    </td>
                    <td>{item.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

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

        {rawResponse && (
          <>
            <div className="section-title otp-subsection-title">
              <div className="section-title-left">Raw Carrier Response</div>
            </div>
            <pre className="otp-text-preview">
              {typeof rawResponse === 'string' ? rawResponse : JSON.stringify(rawResponse, null, 2)}
            </pre>
          </>
        )}

        {result && !result.error && (
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
