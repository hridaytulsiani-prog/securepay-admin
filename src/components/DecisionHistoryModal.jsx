import { useEffect, useState } from 'react'
import Modal from './Modal'
import { api } from '../api/client'

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '-'
}

function formatStatus(value) {
  return (value || '').replace(/_/g, ' ')
}

export default function DecisionHistoryModal({ enquiry, onClose }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    api
      .decisionHistory({ case_type: 'enquiry', case_id: enquiry.enquiry_id })
      .then((data) => {
        setRows(data.results || [])
        setError('')
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [enquiry.enquiry_id])

  return (
    <Modal title={`Decision History - ${enquiry.enquiry_id}`} onClose={onClose} width={760}>
      <div className="history-summary">
        <div>
          <span>Order ID</span>
          <strong>{enquiry.order_id}</strong>
        </div>
        <div>
          <span>Current Status</span>
          <strong>{formatStatus(enquiry.resolution_status || enquiry.status)}</strong>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {loading ? (
        <div className="empty-row">Loading history...</div>
      ) : rows.length === 0 ? (
        <div className="empty-row">No decision history found.</div>
      ) : (
        <div className="decision-timeline">
          {rows.map((row) => (
            <div className="decision-timeline-item" key={row.id}>
              <div className="decision-timeline-date">
                <strong>V{row.version}</strong>
                <span>{formatDate(row.created_at)}</span>
              </div>
              <div className="decision-timeline-body">
                <div className="decision-timeline-title">
                  <span className={`status-pill status-${(row.status || '').toLowerCase()}`}>
                    {formatStatus(row.status)}
                  </span>
                  <strong>{row.title}</strong>
                </div>
                {row.remarks ? <p>{row.remarks}</p> : null}
                <div className="cell-muted">
                  {row.actor || 'System'}{row.actor_role ? ` - ${row.actor_role}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
