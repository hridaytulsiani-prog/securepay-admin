// A ticket reference (merchant or customer) that opens its chat window right where you are (no page change).
import { useState } from 'react'
import { api } from '../api/client'
import { ChatModal as CustomerChatModal, DetailsModal } from '../pages/CustomerIssuesPage'
import { ChatModal as MerchantChatModal } from '../pages/MerchantIssuesPage'

export default function TicketChatLink({ reference, kind = 'merchant', view = 'chat', children }) {
  const customer = kind === 'customer'
  const ChatModal = customer ? CustomerChatModal : MerchantChatModal
  const [row, setRow] = useState(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    const data = await (customer ? api.customerIssues : api.merchantIssues)({ page: 1, limit: 5, q: reference })
    const found = (data.results || []).find((item) => item.reference === reference)
    if (found) setRow(found)
    return found
  }

  async function open() {
    setBusy(true)
    try {
      await load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" className="oc-ticket-link" onClick={open} disabled={busy}>
        {children}
      </button>
      {row && view === 'details' ? <DetailsModal row={row} onClose={() => setRow(null)} /> : null}
      {row && view !== 'details' ? <ChatModal key={row.id} row={row} onClose={() => setRow(null)} onChanged={load} /> : null}
    </>
  )
}
