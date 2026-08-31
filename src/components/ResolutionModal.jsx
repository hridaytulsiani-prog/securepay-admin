// Lets an admin record where the disputed money went for one enquiry
// (refunded to the customer, or paid out to the merchant) with a reason.
// Mirrors the backend's own validation (reason required unless
// "Unresolved") so the error shows up instantly, before the round trip.
//
// IMPORTANT: this is a RECORD, not an ACTION. Submitting "Money Refunded"
// here does NOT call Razorpay, does NOT trigger any real refund or payout —
// it only saves the decision + reason on the backend's EnquiryData row (see
// adminpanel.api.v1.enquiry_actions_views.AdminEnquiryResolutionView's
// module docstring for the full explanation). The admin still has to go
// issue the actual refund/payout separately, e.g. via the Razorpay
// dashboard. If you're asked to make this button "actually refund the
// customer", that integration doesn't exist yet.
import { useState } from 'react'
import Modal from './Modal'
import { api } from '../api/client'

const OPTIONS = [
  { value: 'unresolved', label: 'Unresolved' },
  { value: 'money_refunded', label: 'Money Refunded (to customer)' },
  { value: 'money_to_merchant', label: 'Money To Merchant' },
]

export default function ResolutionModal({ enquiry, onClose, onChanged }) {
  // Pre-fill with whatever's already on the enquiry, so re-opening this
  // modal shows the current decision instead of resetting to "Unresolved".
  const [resolutionStatus, setResolutionStatus] = useState(enquiry.resolution_status || 'unresolved')
  const [reason, setReason] = useState(enquiry.resolution_reason || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (resolutionStatus !== 'unresolved' && !reason.trim()) {
      setError('A reason is required for this status.')
      return
    }
    setSubmitting(true)
    try {
      await api.updateEnquiryResolution(enquiry.id, resolutionStatus, reason.trim())
      onChanged?.() // refresh the Enquiries table's Action column
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={`Update Action — ${enquiry.enquiry_id}`} onClose={onClose} width={480}>
      <form className="resolution-form" onSubmit={handleSubmit}>
        <div className="toolbar-field">
          <label htmlFor="resolution-status">Action</label>
          <select
            id="resolution-status"
            value={resolutionStatus}
            onChange={(e) => setResolutionStatus(e.target.value)}
          >
            {OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="toolbar-field">
          <label htmlFor="resolution-reason">Reason</label>
          <textarea
            id="resolution-reason"
            rows={4}
            placeholder="Why is the money being moved this way?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        {error && <div className="error-banner">{error}</div>}

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
