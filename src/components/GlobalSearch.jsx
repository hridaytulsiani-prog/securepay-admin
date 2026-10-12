// The search box in the admin top bar. Type an order ID, AWB, customer, merchant, enquiry or issue number: a short
// list of the best matches drops down as you type, and Enter (or "See all results") opens the full results page,
// which shows every detail the admin app has about what was found.
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'

const MIN_LENGTH = 2

// Where a click on a result goes: the page that lists that kind of record, already searched for it.
// (An order opens the Order check page instead.)
function destination(sectionKey, row) {
  const go = (path, text) => `${path}?q=${encodeURIComponent(text)}`
  switch (sectionKey) {
    case 'orders':
      return go('/dashboard/orders', row.merchant_order_id)
    case 'issues':
      return go('/dashboard/merchant-issues', row.reference)
    case 'enquiries':
      return go('/dashboard/enquiries', row.enquiry_id)
    case 'messages':
      return go(row.source === 'merchant' ? '/dashboard/merchant-queries' : '/dashboard/messages', row.email)
    case 'merchants':
      return go('/dashboard/merchant-users', row.merchant_name)
    case 'labels':
      return row.order_id ? go('/dashboard/orders', row.order_id) : null
    default:
      return null
  }
}

// Section order and labels in the drop-down.
const SECTIONS = [
  { key: 'orders', label: 'Orders', title: (row) => row.merchant_order_id, sub: (row) => [row.awb && `AWB ${row.awb}`, row.customer_name, row.merchant_name].filter(Boolean).join(' · '), tag: (row) => row.delivery_status || row.order_status },
  { key: 'issues', label: 'Merchant issues', title: (row) => row.reference, sub: (row) => `${row.merchant_name} · ${row.issue_type_label}`, tag: (row) => row.status_label },
  { key: 'enquiries', label: 'Customer enquiries', title: (row) => row.enquiry_id, sub: (row) => `Order ${row.order_id}`, tag: (row) => row.status },
  { key: 'messages', label: 'Customer messages', title: (row) => row.name, sub: (row) => row.message, tag: (row) => row.status_label },
  { key: 'merchants', label: 'Merchants', title: (row) => row.merchant_name, sub: (row) => row.merchant_email, tag: () => '' },
  { key: 'labels', label: 'Label checks', title: (row) => row.awb || row.order_id || row.file_name, sub: (row) => row.file_name, tag: (row) => row.status },
]

export default function GlobalSearch() {
  const navigate = useNavigate()
  const boxRef = useRef(null)
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [state, setState] = useState({ loading: false, data: null })

  // Search while typing (after a short pause), ignoring answers that arrive late.
  useEffect(() => {
    const query = text.trim()
    if (query.length < MIN_LENGTH) {
      setState({ loading: false, data: null })
      return undefined
    }
    let active = true
    setState((current) => ({ ...current, loading: true }))
    const timer = window.setTimeout(() => {
      api
        .search({ q: query, limit: 4 })
        .then((data) => active && setState({ loading: false, data }))
        .catch(() => active && setState({ loading: false, data: null }))
    }, 280)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [text])

  useEffect(() => {
    if (!open) return undefined
    const closeOnOutside = (event) => {
      if (!boxRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutside)
    return () => document.removeEventListener('mousedown', closeOnOutside)
  }, [open])

  function openResults(query) {
    const value = (query ?? text).trim()
    if (value.length < MIN_LENGTH) return
    setOpen(false)
    navigate(`/dashboard/search?q=${encodeURIComponent(value)}`)
  }

  function handleSubmit(event) {
    event.preventDefault()
    openResults()
  }

  const data = state.data
  const total = data ? Object.values(data.counts || {}).reduce((sum, count) => sum + count, 0) : 0
  // An exact AWB (or order ID) typed in full means one order: show just that one.
  const typed = text.trim().toLowerCase()
  const allOrders = (data && data.orders) || []
  const exactOrders = allOrders.filter((row) => (row.awb || '').toLowerCase() === typed)
  const exactIds = allOrders.filter((row) => (row.merchant_order_id || '').toLowerCase() === typed)
  const orderRows = exactOrders.length ? exactOrders.slice(0, 1) : exactIds.length ? exactIds.slice(0, 1) : allOrders
  const hasOrders = orderRows.length > 0
  const showPanel = open && text.trim().length >= MIN_LENGTH

  return (
    <div className="global-search" ref={boxRef}>
      <form className="global-search-form" onSubmit={handleSubmit} role="search">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m16.5 16.5 4 4" />
        </svg>
        <input
          type="search"
          value={text}
          onChange={(event) => {
            setText(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}
          placeholder="Search order ID, AWB, customer, merchant, issue..."
          aria-label="Search the admin app"
        />
      </form>

      {showPanel ? (
        <div className="global-search-panel" role="listbox">
          {state.loading && !data ? <p className="global-search-note">Searching...</p> : null}
          {data && total === 0 && !state.loading ? <p className="global-search-note">Nothing found for &quot;{text.trim()}&quot;.</p> : null}
          {data
            ? SECTIONS.filter((section) => (data[section.key] || []).length > 0 && (!hasOrders || section.key === 'orders')).map((section) => (
                <div className="global-search-group" key={section.key}>
                  {section.key === 'orders' ? null : <p className="global-search-group-label">{section.label}</p>}
                  {(section.key === 'orders' ? orderRows : data[section.key]).map((row) => {
                    const title = section.key === 'orders' && row.awb && (row.awb || '').toLowerCase().includes(typed) ? row.awb : section.title(row)
                    const tag = section.tag(row)
                    return (
                      <button
                        key={`${section.key}-${row.id}`}
                        type="button"
                        className="global-search-hit"
                        onClick={() => {
                          setOpen(false)
                          if (section.key === 'orders') {
                            navigate(`/dashboard/order-check?order=${encodeURIComponent(row.awb || row.merchant_order_id)}`)
                            return
                          }
                          const target = destination(section.key, row)
                          if (target) navigate(target)
                          else openResults(title)
                        }}
                      >
                        <span className="global-search-hit-main">
                          <strong>{title}</strong>
                          {section.key === 'orders' ? (
                            <span className="global-search-check">Check order details report</span>
                          ) : (
                            <small>{section.sub(row)}</small>
                          )}
                        </span>
                        {tag ? <em>{String(tag).replace(/_/g, ' ')}</em> : null}
                      </button>
                    )
                  })}
                </div>
              ))
            : null}
          {data && total > 0 && !hasOrders ? (
            <button type="button" className="global-search-all" onClick={() => openResults()}>
              See all results for &quot;{text.trim()}&quot;
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
