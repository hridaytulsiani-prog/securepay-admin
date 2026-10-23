import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'

function pretty(value) {
  if (value === 'MANUAL_REVIEW' || value === 'UNDER_REVIEW') return 'Needs Review'
  if (value === 'NOT_UPLOADED' || value === 'NOT_FOUND') return 'Not Uploaded'
  return String(value || '-')
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function statusClass(value) {
  const normalized = String(value || '').toUpperCase()
  if (['HELD', 'PROTECTED', 'RELEASE', 'REFUND', 'COMPLETED', 'MATCHED', 'SUCCEEDED', 'DELIVERED', 'CONFIRMED', 'APPROVED', 'VERIFIED', 'ACCEPTED'].includes(normalized)) {
    return 'pa-pill pa-pill-ok'
  }
  if (['FAILED', 'UNSUPPORTED', 'REJECTED', 'EXCEPTION', 'DELIVERY_FAILED', 'RETURNED', 'NOT_APPROVED', 'NOT_VERIFIED'].includes(normalized)) {
    return 'pa-pill pa-pill-bad'
  }
  return 'pa-pill pa-pill-warn'
}

function formatMoney(order) {
  return `₹${order?.amount || '0.00'}`
}

function decisionReason(order) {
  const decision = order?.decision_state
  const pdfStatus = order?.pdf_verification?.status
  const courierStatus = order?.courier_verification?.status

  if (decision === 'RELEASE') {
    return 'PDF verification and courier verification are successful, so the merchant amount can be released.'
  }
  if (decision === 'REFUND') {
    if (pdfStatus === 'NOT_APPROVED') return 'Merchant PDF verification failed'
    if (courierStatus === 'NOT_VERIFIED') return 'Courier verification failed'
    return 'Verification checks did not pass'
  }
  if (decision === 'MANUAL_REVIEW') {
    return 'This order needs manual review'
  }
  return 'Waiting for successful PDF and courier verification before release/refund command.'
}

function finalCommandLabel(order) {
  if (!order) return 'Provider Accept'
  if (order.command?.status === 'ACCEPTED') return `Provider Accepted ${pretty(order.command.decision)}`
  if (order.command?.status === 'NOT_SENT') return `Provider Accept ${pretty(order.command.decision)}`
  if (order.command?.status) return `Provider ${pretty(order.command.status)}`
  if (order.decision_state === 'RELEASE') return 'Provider Accept Release'
  if (order.decision_state === 'REFUND') return 'Provider Accept Refund'
  return 'Provider Accept'
}

export default function PAControlPlanePage() {
  const pageSize = 25
  const [orders, setOrders] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [q, setQ] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [acting, setActing] = useState(false)
  const [page, setPage] = useState(1)
  const [sortOrder, setSortOrder] = useState('newest')

  const selected = useMemo(
    () => orders.find((item) => item.vaultpay_order_id === selectedId) || orders[0] || null,
    [orders, selectedId],
  )

  const load = useCallback((options = {}) => {
    setLoading(true)
    setError('')
    api
      .paOrders({ q, sync: options.sync ? '1' : '' })
      .then((orderData) => {
        const nextOrders = orderData.results || []
        setOrders(nextOrders)
        setPage(1)
        if (!selectedId && nextOrders[0]) setSelectedId(nextOrders[0].vaultpay_order_id)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [q, selectedId])

  useEffect(() => {
    load()
  }, [load])

  async function providerAccept() {
    if (!selected) return
    setError('')
    setSuccess('')
    setActing(true)
    try {
      const data = await api.paOrderAction(selected.vaultpay_order_id, 'provider-accept')
      setOrders((current) =>
        current.map((item) => (item.vaultpay_order_id === data.order.vaultpay_order_id ? data.order : item)),
      )
      setSelectedId(data.order.vaultpay_order_id)
      setSuccess('Provider accepted. Merchant dashboard notification has been created.')
    } catch (err) {
      setError(err.message)
      if (err.order) {
        setOrders((current) =>
          current.map((item) => (item.vaultpay_order_id === err.order.vaultpay_order_id ? err.order : item)),
        )
      }
    } finally {
      setActing(false)
    }
  }

  const commandDisabled = !selected || acting || !['RELEASE', 'REFUND'].includes(selected.decision_state) || selected.command?.status === 'ACCEPTED'
  const totalPages = Math.max(1, Math.ceil(orders.length / pageSize))
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1)
  const sortedOrders = useMemo(() => {
    const getTime = (order) => new Date(order.updated_at || order.created_at || order.order_date || 0).getTime()
    return [...orders].sort((a, b) => (
      sortOrder === 'oldest' ? getTime(a) - getTime(b) : getTime(b) - getTime(a)
    ))
  }, [orders, sortOrder])
  const visibleOrders = sortedOrders.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  return (
    <div className="pa-page">
      <div className="panel-card pa-surface">
        <div className="section-title pa-section-title">
          <div className="section-title-left">
            <span className="orders-section-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M6.5 3.5h11A2.5 2.5 0 0 1 20 6v12a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18V6a2.5 2.5 0 0 1 2.5-2.5Zm2 4a1 1 0 0 0 0 2h7a1 1 0 1 0 0-2h-7Zm0 3.5a1 1 0 1 0 0 2h7a1 1 0 0 0 0-2h-7Zm0 3.5a1 1 0 0 0 0 2h4.5a1 1 0 0 0 0-2H8.5Z" />
              </svg>
            </span>
            PA order control
          </div>
        </div>

        <form
          className="toolbar pa-toolbar"
          onSubmit={(event) => {
            event.preventDefault()
            load()
          }}
        >
          <div className="toolbar-field awb-field">
            <label htmlFor="pa-search">Search orders:</label>
            <input
              id="pa-search"
              value={q}
              onChange={(event) => {
                setQ(event.target.value)
                setPage(1)
              }}
              placeholder="order id, provider ref, merchant"
            />
          </div>
          <button type="submit">{loading ? 'Loading...' : 'Search'}</button>
          <div className="toolbar-field">
            <label htmlFor="pa-sort-order">Sort:</label>
            <select
              id="pa-sort-order"
              value={sortOrder}
              onChange={(event) => {
                setSortOrder(event.target.value)
                setPage(1)
              }}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
          <button type="button" onClick={() => load({ sync: true })}>
            Refresh
          </button>
        </form>

      {error ? <div className="error-banner">{error}</div> : null}
      {success ? <div className="success-banner">{success}</div> : null}

      <section className="pa-section pa-orders-section">
        <div className="section-title pa-table-title">
          <div className="section-title-left">
            PA orders <span className="count-badge">{orders.length}</span>
          </div>
        </div>
        <div className="table-wrap">
          <table className="pa-table pa-production-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Payment ID</th>
                <th>Merchant</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Payment</th>
                {/* Kept for the future verification workflow.
                <th>PDF Check</th>
                <th>Courier Check</th>
                */}
                <th>Decision</th>
                <th>Aggregator Request</th>
                <th>PA Message</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr><td colSpan={10} className="empty-row">No real orders found for PA control.</td></tr>
              ) : visibleOrders.map((order) => (
                <tr
                  key={order.vaultpay_order_id}
                  className={selected?.vaultpay_order_id === order.vaultpay_order_id ? 'selected-row' : ''}
                  onClick={() => setSelectedId(order.vaultpay_order_id)}
                >
                  <td>
                    <Link
                      className="orders-data-link pa-order-id"
                      to={`/dashboard/order-check?order=${encodeURIComponent(order.merchant_order_id || order.vaultpay_order_id)}`}
                      onClick={(event) => event.stopPropagation()}
                    >
                      {order.merchant_order_id || order.vaultpay_order_id}
                    </Link>
                  </td>
                  <td>
                    {order.display_payment_id ? (
                      <Link
                        className="orders-data-link orders-payment-id-link pa-payment-id"
                        to={`/dashboard/order-check?order=${encodeURIComponent(order.merchant_order_id || order.vaultpay_order_id)}`}
                        onClick={(event) => event.stopPropagation()}
                      >
                        {order.display_payment_id}
                      </Link>
                    ) : '-'}
                  </td>
                  <td>{order.merchant_id ? <Link className="merchant-history-link" to={`/dashboard/merchants/${order.merchant_id}`} onClick={(event) => event.stopPropagation()}>{order.merchant_name || '-'}</Link> : order.merchant_name || '-'}</td>
                  <td>
                    <div>{order.customer?.name || '-'}</div>
                  </td>
                  <td>{formatMoney(order)}</td>
                  <td><span className={statusClass(order.payment_state)}>{pretty(order.payment_state)}</span></td>
                  {/* Kept for the future verification workflow.
                  <td>
                    <span className={statusClass(order.pdf_verification?.status)}>
                      {pretty(order.pdf_verification?.status)}
                    </span>
                  </td>
                  <td>
                    <span className={statusClass(order.courier_verification?.status)}>
                      {pretty(order.courier_verification?.status)}
                    </span>
                  </td>
                  */}
                  <td><span className={statusClass(order.decision_state)}>{pretty(order.decision_state)}</span></td>
                  <td>
                    {order.aggregator_request?.status ? (
                      <span className={statusClass(order.aggregator_request.status)}>
                        {pretty(order.aggregator_request.decision)} request {pretty(order.aggregator_request.status)}
                      </span>
                    ) : order.decision_window?.status === 'PENDING' ? (
                      <span className="pa-pill pa-pill-warn">
                        {pretty(order.decision_window.decision)} decision staged
                      </span>
                    ) : order.decision_state === 'MANUAL_REVIEW' ? (
                      <span className="cell-muted">Waiting for decision</span>
                    ) : (
                      <span className="cell-muted">Pending automation</span>
                    )}
                  </td>
                  <td><span className={statusClass(order.command?.status || order.pa_command_state)}>{pretty(order.command?.status || order.pa_command_state)}</span></td>
                  <td className="pa-reason-cell">{decisionReason(order)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pa-pagination">
          <span className="pa-pagination-summary">
            Showing {visibleOrders.length} of {orders.length} PA orders.
          </span>
          <div className="pa-pagination-controls" aria-label="PA orders pagination">
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
      </section>

      {/* PA detail sections are intentionally hidden from the UI, but kept here for future workflow use. */}
      {false && selected ? (
        <>
          <section className="pa-section">
            <div className="section-title">Selected Order Proof</div>
            <div className="pa-state-grid">
              {[
                ['Payment', selected.payment_state],
                ['PDF Check', selected.pdf_verification?.status],
                ['Courier Check', selected.courier_verification?.status],
                ['Decision', selected.decision_state],
                ['PA Message', selected.command?.status || selected.pa_command_state],
                ['Reconciliation', selected.reconciliation?.status],
              ].map(([label, value]) => (
                <div className="pa-state-cell" key={label}>
                  <div className="cell-muted">{label}</div>
                  <span className={statusClass(value)}>{pretty(value)}</span>
                </div>
              ))}
              <div className="pa-state-cell">
                <div className="cell-muted">Amount</div>
                <div className="cell-strong">{formatMoney(selected)}</div>
              </div>
              <div className="pa-state-cell">
                <div className="cell-muted">Reason</div>
                <div className="cell-strong">{decisionReason(selected)}</div>
              </div>
            </div>
          </section>

          <section className="pa-section">
            <div className="section-title">Final Financial Instruction</div>
            <div className="pa-actions-row">
              <button type="button" onClick={providerAccept} disabled={commandDisabled}>
                {acting ? 'Sending...' : finalCommandLabel(selected)}
              </button>
            </div>
            <div className="pa-command-summary">
              <div>
                <span className="cell-muted">Request Sent</span>
                <strong>
                  {selected.aggregator_request?.status
                    ? `${pretty(selected.aggregator_request.decision)} request ${pretty(selected.aggregator_request.status)}`
                    : 'No request sent yet'}
                </strong>
              </div>
              <div>
                <span className="cell-muted">Command</span>
                <strong>{selected.command?.command_id || 'Not sent yet'}</strong>
              </div>
              <div>
                <span className="cell-muted">Action</span>
                <strong>{pretty(selected.command?.decision || selected.decision_state)}</strong>
              </div>
              <div>
                <span className="cell-muted">Provider Reference</span>
                <strong>{selected.command?.provider_reference || selected.pa_payment_id || selected.pa_order_id || '-'}</strong>
              </div>
              <div>
                <span className="cell-muted">Status</span>
                <span className={statusClass(selected.command?.status || selected.pa_command_state)}>
                  {pretty(selected.command?.status || selected.pa_command_state)}
                </span>
              </div>
              <div>
                <span className="cell-muted">Merchant Notification</span>
                <strong>
                  {selected.command?.status === 'ACCEPTED'
                    ? selected.command.decision === 'RELEASE'
                      ? 'Release amount credited notification sent'
                      : 'Refund/cancelled order notification sent'
                    : 'Created after provider accepts'}
                </strong>
              </div>
              <div>
                <span className="cell-muted">Evidence URL</span>
                {selected.command?.evidence_report_url ? (
                  <a href={selected.command.evidence_report_url} target="_blank" rel="noreferrer">
                    Open report
                  </a>
                ) : (
                  <strong>Created after release/refund request</strong>
                )}
              </div>
            </div>
          </section>
        </>
      ) : null}
      </div>
    </div>
  )
}
