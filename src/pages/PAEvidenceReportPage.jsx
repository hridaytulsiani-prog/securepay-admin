import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'

function pretty(value) {
  return String(value || '-').replaceAll('_', ' ')
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '-'
}

function EvidenceRow({ label, value }) {
  return (
    <div className="evidence-row">
      <span>{label}</span>
      <strong>{value || '-'}</strong>
    </div>
  )
}

export default function PAEvidenceReportPage() {
  const { token } = useParams()
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .paEvidenceReport(token)
      .then((data) => {
        setReport(data.report)
        setError('')
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return <div className="evidence-page"><div className="panel-card">Loading evidence report...</div></div>
  }

  if (error) {
    return (
      <div className="evidence-page">
        <div className="error-banner">{error}</div>
        <Link to="/dashboard/pa-control">Back to PA Control</Link>
      </div>
    )
  }

  return (
    <div className="evidence-page">
      <header className="evidence-header">
        <div>
          <div className="evidence-kicker">VaultPay Evidence Report</div>
          <h1>{pretty(report.decision.action)} Evidence</h1>
          <p>{report.decision.reason}</p>
        </div>
        <Link to="/dashboard/pa-control">Back to PA Control</Link>
      </header>

      <section className="evidence-grid">
        <div className="panel-card">
          <div className="section-title">Order And Payment</div>
          <EvidenceRow label="VaultPay Order ID" value={report.vaultpay_order_id} />
          <EvidenceRow label="Merchant Order ID" value={report.merchant_order_id} />
          <EvidenceRow label="Merchant" value={report.merchant.name} />
          <EvidenceRow label="Customer" value={`${report.customer.name || '-'} ${report.customer.phone || ''}`} />
          <EvidenceRow label="Amount" value={`${report.amount.currency} ${report.amount.display}`} />
        </div>

        <div className="panel-card">
          <div className="section-title">Payment Aggregator Reference</div>
          <EvidenceRow label="Provider" value={report.payment_aggregator.display_name} />
          <EvidenceRow label="PA Account ID" value={report.payment_aggregator.pa_account_id} />
          <EvidenceRow label="PA Order ID" value={report.payment_aggregator.pa_order_id} />
          <EvidenceRow label="PA Payment ID" value={report.payment_aggregator.pa_payment_id} />
        </div>

        <div className="panel-card">
          <div className="section-title">Decision Basis</div>
          <EvidenceRow label="Decision" value={pretty(report.decision.action)} />
          <EvidenceRow label="Reason Code" value={pretty(report.decision.reason_code)} />
          <EvidenceRow label="Payment State" value={pretty(report.evidence.payment_state)} />
          <EvidenceRow label="Protection State" value={pretty(report.evidence.protection_state)} />
          <EvidenceRow label="Delivery State" value={pretty(report.evidence.fulfilment_state)} />
          <EvidenceRow label="Customer Confirmation" value={pretty(report.evidence.customer_confirmation)} />
        </div>

        <div className="panel-card">
          <div className="section-title">PDF Verification Evidence</div>
          <EvidenceRow label="PDF Status" value={pretty(report.evidence.pdf_verification?.status)} />
          <EvidenceRow label="Summary" value={report.evidence.pdf_verification?.summary} />
          <EvidenceRow label="File Name" value={report.evidence.pdf_verification?.file_name} />
          <EvidenceRow label="Verdict" value={pretty(report.evidence.pdf_verification?.verdict)} />
          <EvidenceRow label="Risk Verdict" value={pretty(report.evidence.pdf_verification?.risk_verdict)} />
          <EvidenceRow label="Score" value={String(report.evidence.pdf_verification?.score ?? '-')} />
          <EvidenceRow label="Risk Score" value={String(report.evidence.pdf_verification?.risk_score ?? '-')} />
          <EvidenceRow label="Courier" value={report.evidence.pdf_verification?.courier_partner || report.evidence.pdf_verification?.delivery_partner} />
          <EvidenceRow label="AWB" value={report.evidence.pdf_verification?.awb} />
          <EvidenceRow label="AWB Match" value={pretty(report.evidence.pdf_verification?.awb_match)} />
        </div>

        <div className="panel-card">
          <div className="section-title">Command And Reconciliation</div>
          <EvidenceRow label="Command ID" value={report.command.command_id} />
          <EvidenceRow label="Command Status" value={pretty(report.command.status)} />
          <EvidenceRow label="Provider Reference" value={report.command.provider_reference} />
          <EvidenceRow label="Reconciliation" value={pretty(report.evidence.reconciliation)} />
          <EvidenceRow label="Issued At" value={formatDate(report.command.issued_at)} />
          <EvidenceRow label="Completed At" value={formatDate(report.command.completed_at)} />
        </div>
      </section>

      <section className="panel-card">
        <div className="section-title">Decision Timeline</div>
        <div className="evidence-timeline">
          {(report.audit || []).map((item, index) => (
            <div className="evidence-timeline-row" key={`${item.created_at}-${index}`}>
              <div>
                <strong>{pretty(item.event_type)}</strong>
                <span>{formatDate(item.created_at)}</span>
              </div>
              <p>{item.message}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
