// Full results for the top-bar search (/dashboard/search?q=...). Searching an order ID or an AWB shows the order with
// everything related to it on one page: shipment tracking, payment states and ledger, shipping-label checks, delivery
// verification, customer enquiries and merchant issues. Merchants, enquiries, issues, customer messages and label
// checks that match are listed underneath.
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '-'
}

function pretty(value) {
  return String(value || '-')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, (letter) => letter.toUpperCase())
}

function formatAmount(amount, currency) {
  const number = Number(amount)
  if (Number.isNaN(number)) return '-'
  return `${currency === 'INR' || !currency ? '₹' : `${currency} `}${number.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function Field({ label, children }) {
  return (
    <div className="sr-field">
      <span>{label}</span>
      <strong>{children || '-'}</strong>
    </div>
  )
}

function Chip({ children, tone = 'blue' }) {
  return <span className={`sr-chip is-${tone}`}>{children}</span>
}

function MiniTable({ title, columns, rows, empty }) {
  return (
    <div className="sr-block">
      <h4>{title}</h4>
      {rows.length === 0 ? (
        <p className="sr-empty">{empty}</p>
      ) : (
        <div className="sr-table-wrap">
          <table>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.label}>{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  {columns.map((column) => (
                    <td key={column.label}>{column.render(row)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function OrderCard({ order }) {
  const detail = order.detail || {}
  return (
    <article className="sr-card">
      <header className="sr-card-head">
        <div>
          <h3>{order.merchant_order_id}</h3>
          <p>{order.pa_order_id ? `Aggregator order ${order.pa_order_id}` : 'No aggregator order yet'}</p>
        </div>
        <div className="sr-chips">
          <Link className="sr-report-btn" to={`/dashboard/order-check?order=${encodeURIComponent(order.awb || order.merchant_order_id)}`}>
            Check order
          </Link>
          <Chip tone="green">{pretty(order.order_status)}</Chip>
          <Chip>Payment: {pretty(order.payment_state)}</Chip>
          {order.delivery_status ? <Chip tone="amber">Delivery: {pretty(order.delivery_status)}</Chip> : <Chip tone="grey">No shipment</Chip>}
        </div>
      </header>

      <div className="sr-grid">
        <Field label="Amount">{formatAmount(order.amount, order.currency)}</Field>
        <Field label="Order date">{formatDate(order.order_date)}</Field>
        <Field label="Merchant">{order.merchant_name}</Field>
        <Field label="Merchant email">{order.merchant_email}</Field>
        <Field label="Customer">{order.customer_name}</Field>
        <Field label="Customer phone">{order.customer_phone}</Field>
        <Field label="Customer email">{order.customer_email}</Field>
        <Field label="Delivery address">{order.customer_address}</Field>
        <Field label="Courier">{order.courier}</Field>
        <Field label="AWB number">{order.awb}</Field>
        <Field label="Payment provider">{order.payment_provider}</Field>
        <Field label="Payment ID">{order.pa_payment_id}</Field>
      </div>

      <div className="sr-columns">
        <MiniTable
          title="Delivery tracking"
          empty="No tracking history yet."
          rows={detail.tracking_history || []}
          columns={[
            { label: 'Time', render: (row) => formatDate(row.ts) },
            { label: 'Status', render: (row) => pretty(row.status) },
            { label: 'Note', render: (row) => row.note || '-' },
          ]}
        />
        <MiniTable
          title="Payment state changes"
          empty="No payment changes recorded."
          rows={detail.payment_transitions || []}
          columns={[
            { label: 'Time', render: (row) => formatDate(row.created_at) },
            { label: 'From', render: (row) => pretty(row.from_state) },
            { label: 'To', render: (row) => pretty(row.to_state) },
            { label: 'Source', render: (row) => row.source },
          ]}
        />
      </div>

      <div className="sr-columns">
        <MiniTable
          title="Payment ledger"
          empty="No ledger entries."
          rows={detail.ledger || []}
          columns={[
            { label: 'Time', render: (row) => formatDate(row.created_at) },
            { label: 'Type', render: (row) => pretty(row.entry_type) },
            { label: 'Amount', render: (row) => formatAmount(row.amount, row.currency) },
            { label: 'Reference', render: (row) => row.reference || '-' },
          ]}
        />
        <MiniTable
          title="Shipping label checks"
          empty="No label uploaded for this order."
          rows={detail.labels || []}
          columns={[
            { label: 'Uploaded', render: (row) => formatDate(row.uploaded_at) },
            { label: 'File', render: (row) => row.file_name },
            { label: 'Status', render: (row) => pretty(row.status) },
            { label: 'Verdict', render: (row) => pretty(row.verdict) },
          ]}
        />
      </div>

      <div className="sr-block">
        <h4>Delivery verification</h4>
        {detail.verification ? (
          <p className="sr-line">
            <Chip tone={detail.verification.decision === 'VERIFIED' ? 'green' : 'red'}>{pretty(detail.verification.decision)}</Chip>
            {detail.verification.decided_by ? ` by ${detail.verification.decided_by}` : ''} on {formatDate(detail.verification.decided_at)}
          </p>
        ) : (
          <p className="sr-empty">No manual verification decision for this AWB.</p>
        )}
      </div>

      <div className="sr-columns">
        <MiniTable
          title="Customer enquiries about this order"
          empty="No customer enquiries."
          rows={detail.enquiries || []}
          columns={[
            { label: 'Enquiry', render: (row) => row.enquiry_id },
            { label: 'Received?', render: (row) => pretty(row.receipt_status) },
            { label: 'Status', render: (row) => pretty(row.status) },
            { label: 'What the customer said', render: (row) => row.text },
          ]}
        />
        <MiniTable
          title="Merchant issues about this order"
          empty="No merchant issues."
          rows={detail.issues || []}
          columns={[
            {
              label: 'Ticket',
              render: (row) => <Link to={`/dashboard/merchant-issues?q=${encodeURIComponent(row.reference)}`}>{row.reference}</Link>,
            },
            { label: 'Type', render: (row) => row.issue_type_label },
            { label: 'Status', render: (row) => row.status_label },
            { label: 'Raised', render: (row) => formatDate(row.created_at) },
          ]}
        />
      </div>
    </article>
  )
}

function ListSection({ title, rows, columns }) {
  if (!rows || rows.length === 0) return null
  return (
    <section className="sr-section">
      <h2>{title} <span>{rows.length}</span></h2>
      <div className="sr-card sr-list-card">
        <div className="sr-table-wrap">
          <table>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.label}>{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {columns.map((column) => (
                    <td key={column.label}>{column.render(row)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

export default function SearchResultsPage() {
  const [params] = useSearchParams()
  const query = (params.get('q') || '').trim()
  const [state, setState] = useState({ query: '', data: null, error: '' })

  useEffect(() => {
    if (query.length < 2) return undefined
    let active = true
    api
      .search({ q: query, detail: 1, limit: 10 })
      .then((data) => active && setState({ query, data, error: '' }))
      .catch((err) => active && setState({ query, data: null, error: err.message }))
    return () => {
      active = false
    }
  }, [query])

  const loading = query.length >= 2 && state.query !== query
  const data = state.query === query ? state.data : null
  const total = data ? Object.values(data.counts || {}).reduce((sum, count) => sum + count, 0) : 0

  return (
    <div className="sr-page">
      <div className="sr-title">
        <h1>Search results</h1>
        <p>{query ? <>for <strong>&quot;{query}&quot;</strong></> : 'Type in the search box at the top.'}</p>
      </div>

      {query.length > 0 && query.length < 2 ? <p className="sr-empty">Type at least 2 characters.</p> : null}
      {loading ? <p className="sr-empty">Searching...</p> : null}
      {state.error && state.query === query ? <div className="error-banner">{state.error}</div> : null}
      {data && total === 0 ? <p className="sr-empty">Nothing found. Try an order ID, an AWB number, a customer name or phone, a merchant name or an ISS ticket number.</p> : null}

      {data && data.orders.length > 0 ? (
        <section className="sr-section">
          <h2>Orders <span>{data.orders.length}</span></h2>
          {data.orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </section>
      ) : null}

      {data ? (
        <>
          <ListSection
            title="Merchant issues"
            rows={data.issues}
            columns={[
              { label: 'Ticket', render: (row) => <Link to={`/dashboard/merchant-issues?q=${encodeURIComponent(row.reference)}`}>{row.reference}</Link> },
              { label: 'Merchant', render: (row) => row.merchant_name },
              { label: 'Type', render: (row) => row.issue_type_label },
              { label: 'Orders', render: (row) => row.order_count },
              { label: 'Status', render: (row) => row.status_label },
              { label: 'Raised', render: (row) => formatDate(row.created_at) },
            ]}
          />
          <ListSection
            title="Customer enquiries"
            rows={data.enquiries}
            columns={[
              { label: 'Enquiry', render: (row) => row.enquiry_id },
              { label: 'Order', render: (row) => row.order_id },
              { label: 'Received?', render: (row) => pretty(row.receipt_status) },
              { label: 'Status', render: (row) => pretty(row.status) },
              { label: 'What the customer said', render: (row) => row.text },
              { label: 'Raised', render: (row) => formatDate(row.created_at) },
            ]}
          />
          <ListSection
            title="Customer messages"
            rows={data.messages}
            columns={[
              { label: 'From', render: (row) => `${row.name} (${row.email})` },
              { label: 'Order', render: (row) => row.order_id || '-' },
              { label: 'Message', render: (row) => row.message },
              { label: 'Status', render: (row) => row.status_label },
              { label: 'Received', render: (row) => formatDate(row.created_at) },
            ]}
          />
          <ListSection
            title="Merchants"
            rows={data.merchants}
            columns={[
              { label: 'Name', render: (row) => row.merchant_name },
              { label: 'Email', render: (row) => row.merchant_email },
              { label: 'Phone', render: (row) => row.merchant_phone },
              { label: 'Joined', render: (row) => formatDate(row.created_at) },
            ]}
          />
          <ListSection
            title="Label checks"
            rows={data.labels}
            columns={[
              { label: 'AWB', render: (row) => row.awb || '-' },
              { label: 'Order', render: (row) => row.order_id || '-' },
              { label: 'Courier', render: (row) => row.courier || '-' },
              { label: 'File', render: (row) => row.file_name },
              { label: 'Status', render: (row) => pretty(row.status) },
              { label: 'Verdict', render: (row) => pretty(row.verdict) },
              { label: 'Uploaded', render: (row) => formatDate(row.uploaded_at) },
            ]}
          />
        </>
      ) : null}
    </div>
  )
}
