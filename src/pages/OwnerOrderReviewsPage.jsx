import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import Modal from '../components/Modal'

function formatAmount(minor, currency = 'INR') {
  const amount = Number(minor || 0) / 100
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount)
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString('en-IN') : '-'
}

export default function OwnerOrderReviewsPage() {
  const [filter, setFilter] = useState('PENDING')
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [selection, setSelection] = useState(null)
  const [modalError, setModalError] = useState('')
  const [acting, setActing] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    api.ownerDecisionReviews({ status: filter })
      .then((data) => {
        setReviews(data.results || [])
        setError('')
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false))
  }, [filter])

  useEffect(() => { load() }, [load])

  async function completeReview() {
    if (!selection) return
    setActing(true)
    setError('')
    setMessage('')
    setModalError('')
    try {
      const result = await api.decideOwnerReview(selection.review.id, { action: selection.action })
      setMessage(selection.action === 'APPROVE'
        ? `${result.review.decision === 'REFUND' ? 'Refund' : 'Release'} approved. The 10-minute revocation window is now active.`
        : 'The manager’s decision was rejected and will not be sent to PA Control.')
      setSelection(null)
      setModalError('')
      load()
    } catch (requestError) {
      setModalError(requestError.message || 'The review could not be submitted. Please try again.')
    } finally {
      setActing(false)
    }
  }

  function closeReviewModal() {
    if (acting) return
    setSelection(null)
    setModalError('')
  }

  return (
    <div className="owner-review-page">
      <section className="panel-card owner-review-surface">
        <div className="section-title owner-review-section-title">
          <div className="section-title-left">
            <span className="orders-section-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M6.5 3.5h11A2.5 2.5 0 0 1 20 6v12a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18V6a2.5 2.5 0 0 1 2.5-2.5Zm2 4a1 1 0 0 0 0 2h7a1 1 0 1 0 0-2h-7Zm0 3.5a1 1 0 1 0 0 2h7a1 1 0 1 0 0-2h-7Zm0 3.5a1 1 0 1 0 0 2h4.5a1 1 0 1 0 0-2H8.5Z" />
              </svg>
            </span>
            High-value order reviews
          </div>
        </div>
        <div className="owner-review-toolbar">
          <p>Approve or reject refund and release decisions of ₹5,000 or more before the 10-minute sending window begins.</p>
          <div className="owner-review-filter" role="group" aria-label="Review status">
            <button type="button" className={filter === 'PENDING' ? 'is-active' : ''} onClick={() => setFilter('PENDING')}>Pending</button>
            <button type="button" className={filter === 'ALL' ? 'is-active' : ''} onClick={() => setFilter('ALL')}>All reviews</button>
          </div>
        </div>

      {error ? <div className="error-banner">{error}</div> : null}
      {message ? <div className="owner-review-success">{message}</div> : null}
      {loading ? <div className="owner-review-empty">Loading owner reviews...</div> : null}
      {!loading && reviews.length === 0 ? (
        <div className="owner-review-empty">
          <span aria-hidden="true">✓</span>
          <h2>No {filter === 'PENDING' ? 'pending ' : ''}reviews</h2>
          <p>High-value decisions assigned to you will appear here.</p>
        </div>
      ) : null}

      {reviews.length > 0 ? (
        <div className="owner-review-table-wrap">
          <table className="owner-review-table">
            <thead>
              <tr>
                <th>Merchant</th>
                <th>Order ID</th>
                <th>Amount</th>
                <th>Requested decision</th>
                <th>Requested by</th>
                <th>Submitted</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((review) => (
                <tr key={review.id}>
                  <td className="owner-review-merchant">
                    <Link to={`/dashboard/merchants/${review.merchant_id}`}>{review.merchant_name}</Link>
                  </td>
                  <td className="owner-review-order-id">
                    {review.report_url ? <Link to={review.report_url}>{review.merchant_order_id || review.vaultpay_order_id}</Link> : <strong>{review.merchant_order_id || review.vaultpay_order_id}</strong>}
                  </td>
                  <td className="owner-review-table-amount">{formatAmount(review.amount_minor, review.currency)}</td>
                  <td>
                    <span className={`status-pill owner-review-decision is-${review.decision.toLowerCase()}`}>
                      {review.decision === 'REFUND' ? 'Refund customer' : 'Release to merchant'}
                    </span>
                  </td>
                  <td>{review.requested_by}</td>
                  <td>{formatDate(review.created_at)}</td>
                  <td><span className={`status-pill owner-review-status is-${review.status.toLowerCase()}`}>{review.status}</span></td>
                  <td>
                    <div className="owner-review-table-actions">
                      {review.status === 'PENDING' ? (
                        <>
                          <button type="button" className="is-reject" onClick={() => { setSelection({ review, action: 'REJECT' }); setModalError('') }}>Reject</button>
                          <button type="button" className="is-approve" onClick={() => { setSelection({ review, action: 'APPROVE' }); setModalError('') }}>Approve</button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      </section>

      {selection ? (
        <Modal title={`${selection.action === 'APPROVE' ? 'Approve' : 'Reject'} ${selection.review.decision.toLowerCase()} decision`} onClose={closeReviewModal} width={500}>
          <div className="owner-review-modal">
            <p>
              {selection.action === 'APPROVE'
                ? 'Approval will stage this financial decision and start the 10-minute revocation window. It will be sent automatically when the timer ends.'
                : 'Rejection stops this request. The manager can review the evidence and submit a new decision later.'}
            </p>
            {modalError ? <div className="owner-review-modal-error" role="alert">{modalError}</div> : null}
            <div className="owner-review-modal-actions">
              <button type="button" onClick={closeReviewModal} disabled={acting}>Cancel</button>
              <button type="button" className={selection.action === 'APPROVE' ? 'is-approve' : 'is-reject'} onClick={completeReview} disabled={acting}>
                {acting ? 'Saving...' : selection.action === 'APPROVE' ? 'Approve Request' : 'Reject request'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
