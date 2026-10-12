// The right-hand side of the Merchant tab: what the merchant raised, in one glance. The top line carries the ticket ID,
// the order ID and the AWB; then the issue the merchant picked, and a short plain summary of their message so an admin
// does not have to open the ticket just to understand it.
function formatDate(value) {
  return value ? new Date(value).toLocaleString() : ''
}

function shorten(text, max) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  return `${cut.slice(0, cut.lastIndexOf(' ') > 40 ? cut.lastIndexOf(' ') : max)}…`
}

// First sentence of what the merchant wrote (or the start of it when there is no full stop).
function firstSentence(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim()
  const match = clean.match(/^.+?[.!?](\s|$)/)
  return shorten(match ? match[0] : clean, 160)
}

export function ticketSummary({ issueType, status, description, merchantMessages, replies, createdAt, orderId }) {
  const lines = []
  if (issueType) lines.push(`The merchant reports: ${issueType.toLowerCase()}${orderId ? ` (order ${orderId})` : ''}.`)
  if (description) lines.push(`In their words: “${firstSentence(description)}”`)
  const chat = []
  if (merchantMessages) chat.push(`${merchantMessages} message${merchantMessages === 1 ? '' : 's'} from the merchant`)
  chat.push(replies ? `${replies} repl${replies === 1 ? 'y' : 'ies'} from us` : 'no reply from us yet')
  lines.push(`${chat.join(', ')}.`)
  const when = formatDate(createdAt)
  if (status || when) lines.push(`${status ? `Status: ${status}` : ''}${status && when ? ' · ' : ''}${when ? `raised ${when}` : ''}.`)
  return lines
}

export default function MerchantTicketPanel({ ticket }) {
  const summary = ticketSummary(ticket)
  return (
    <div className="mt-panel">
      <div className="mt-ids">
        <div><span>Ticket ID</span><strong>{ticket.reference}</strong></div>
        <div><span>Order ID</span><strong>{ticket.orderId || '-'}</strong></div>
        <div><span>AWB</span><strong>{ticket.awb || '-'}</strong></div>
      </div>
      <div className="mt-issue">
        <span>Issue the merchant chose</span>
        <strong>{ticket.issueType}</strong>
      </div>
      <div className="mt-summary">
        <span>Quick summary</span>
        <ul>
          {summary.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
