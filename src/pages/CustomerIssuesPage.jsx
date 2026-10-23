// Customer issues are submitted through the enquiry form and handled by admins here.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { API_BASE_URL, api } from '../api/client'
import Modal from '../components/Modal'
import blueDartLogo from '../assets/couriers/blue-dart-real.png'
import delhiveryLogo from '../assets/couriers/delhivery-real.png'
import dtdcLogo from '../assets/couriers/dtdc-real.png'
import ecomExpressLogo from '../assets/couriers/ecom-express.png'
import ekartLogo from '../assets/couriers/ekart-real.png'
import shadowfaxLogo from '../assets/couriers/shadowfax.svg'
import shiprocketLogo from '../assets/couriers/shiprocket-real.png'
import xpressbeesLogo from '../assets/couriers/xpressbees-wordmark.svg'

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
]

const STATUS_PILL_CLASS = { new: 'status-created', in_progress: 'status-pending', resolved: 'status-resolved' }

const COURIER_LOGOS = [
  { keys: ['blue dart', 'bluedart', 'blue_dart'], label: 'Blue Dart', logo: blueDartLogo },
  { keys: ['delhivery'], label: 'Delhivery', logo: delhiveryLogo },
  { keys: ['dtdc'], label: 'DTDC', logo: dtdcLogo },
  { keys: ['ecom express', 'ecomexpress', 'ecom_express'], label: 'Ecom Express', logo: ecomExpressLogo },
  { keys: ['ekart'], label: 'Ekart', logo: ekartLogo },
  { keys: ['shadowfax', 'shadow fax'], label: 'Shadowfax', logo: shadowfaxLogo },
  { keys: ['shiprocket'], label: 'Shiprocket', logo: shiprocketLogo },
  { keys: ['xpressbees', 'xpress bees', 'xpress_bees'], label: 'Xpressbees', logo: xpressbeesLogo },
]

// Keep in sync with CustomerIssue.ISSUE_TYPE_CHOICES in SecurePay/adminpanel/models.py.
const ISSUE_TYPES = [
  { value: 'not_received', label: 'Order marked delivered but not received' },
  { value: 'wrong_item', label: 'Received a wrong item' },
  { value: 'damaged', label: 'Received a damaged item' },
  { value: 'delayed', label: 'Order is delayed' },
  { value: 'refund', label: 'Refund problem' },
  { value: 'other', label: 'Something else' },
]

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '-'
}

function timeLabel(value) {
  return value ? new Date(value).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : ''
}

function dayKey(value) {
  const parsed = value ? new Date(value) : null
  return parsed && !Number.isNaN(parsed.getTime()) ? `${parsed.getFullYear()}-${parsed.getMonth()}-${parsed.getDate()}` : ''
}

function dayLabel(value) {
  const parsed = new Date(value)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (dayKey(parsed) === dayKey(today)) return 'Today'
  if (dayKey(parsed) === dayKey(yesterday)) return 'Yesterday'
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function pretty(value) {
  return String(value || '').replace(/_/g, ' ').toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase())
}

function normalizeCourierName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function CourierLabel({ courier }) {
  const normalized = normalizeCourierName(courier)
  const match = COURIER_LOGOS.find((item) => item.keys.some((key) => {
    const normalizedKey = normalizeCourierName(key)
    return normalized === normalizedKey || normalized.includes(normalizedKey)
  }))

  if (!courier) return <span className="courier-logo-empty">Not assigned</span>
  if (!match) return <span className="courier-logo-fallback">{courier}</span>
  return (
    <span className={`courier-logo-cell courier-logo-${normalizeCourierName(match.label).replaceAll(' ', '-')}`} title={courier}>
      <img src={match.logo} alt={`${match.label} courier label`} />
    </span>
  )
}

function deliveryStatusClass(value) {
  const normalized = String(value || '').toUpperCase()
  if (normalized.includes('DELIVERED') && !normalized.includes('RTO')) return 'status-success'
  if (['FAILED', 'CANCEL', 'RTO', 'DAMAGED', 'LOST', 'UNDELIVERED'].some((term) => normalized.includes(term))) return 'status-failed'
  return 'status-pending'
}

function isVideoEvidence(name = '') {
  return /\.(mp4|webm|mov|m4v|ogg)$/i.test(name)
}

function isImageAttachment(file) {
  return String(file?.content_type || '').startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(file?.name || '')
}

function attachmentUrl(value) {
  if (!value) return '#'
  return /^https?:\/\//i.test(value) ? value : `${API_BASE_URL}${value}`
}

const EVIDENCE_NOTE_PATTERN = /^\[evidence:([^\]]+)\]\s*/
const CALL_NOTE_PATTERN = /^\[call-note\]\s*/

function evidenceNotePrefix(fileId) {
  return `[evidence:${fileId}] `
}

function evidenceNoteFileId(value) {
  const match = String(value || '').match(EVIDENCE_NOTE_PATTERN)
  return match ? match[1] : null
}

function evidenceNoteText(value) {
  return String(value || '').replace(EVIDENCE_NOTE_PATTERN, '')
}

function isCallNote(value) {
  return CALL_NOTE_PATTERN.test(String(value || ''))
}

function callNoteText(value) {
  return String(value || '').replace(CALL_NOTE_PATTERN, '')
}

function PersonAvatar() {
  return (
    <span className="issue-avatar is-merchant" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="8.5" r="3.6" />
        <path d="M4.5 20c.5-4 3.5-6.2 7.5-6.2s7 2.2 7.5 6.2" />
      </svg>
    </span>
  )
}

function EscroSafeAvatar() {
  return (
    <span className="issue-avatar is-escrosafe" aria-hidden="true">
      <img src="/short-logo-new.png" alt="" />
    </span>
  )
}

// Everything the customer told us on the form: contact, order, their answers, the description and any photos.
function DetailRow({ label, children }) {
  if (!children) return null
  return (
    <div className="sr-field">
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  )
}

export function IssueDetailsBody({ row }) {
  const order = row.order || {}
  const evidence = row.attachments || []
  return (
    <div className="cis-details">
      <div className="cis-details-grid">
        <DetailRow label="Customer">{row.customer_name}</DetailRow>
        <DetailRow label="Phone">{row.customer_phone}</DetailRow>
        <DetailRow label="Email">{row.customer_email}</DetailRow>
        <DetailRow label="Raised">{formatDate(row.created_at)}</DetailRow>
        <DetailRow label="Problem">{row.issue_type_label}</DetailRow>
        <DetailRow label="Status">{row.status_label}</DetailRow>
        <DetailRow label="Order ID / AWB typed">{row.order_ref}</DetailRow>
        <DetailRow label="Payment ID">{order.payment_id}</DetailRow>
        <DetailRow label="Merchant">{order.merchant_id ? <Link className="merchant-history-link" to={`/dashboard/merchants/${order.merchant_id}`}>{order.merchant_name}</Link> : order.merchant_name}</DetailRow>
        <DetailRow label="Courier">{order.courier}</DetailRow>
        <DetailRow label="Delivery status">{order.delivery_status ? pretty(order.delivery_status) : ''}</DetailRow>
      </div>
      {order.merchant_order_id ? null : <p className="cis-note">No order matched what the customer typed.</p>}

      {(row.details || []).length > 0 ? (
        <div className="sr-block">
          <h4>Their answers</h4>
          <dl className="cis-answers">
            {row.details.map((item) => (
              <div key={item.key}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}


      <div className="sr-block">
        <h4>Evidence ({evidence.length})</h4>
        {evidence.length === 0 ? (
          <p className="sr-empty">No evidence file was attached.</p>
        ) : (
          <ul className="cis-photos">
            {evidence.map((file) => (
              <li key={file.id}>
                {isVideoEvidence(file.name) ? (
                  <video controls preload="metadata" src={`${API_BASE_URL}${file.url}`} aria-label={file.name || 'Customer video evidence'} />
                ) : (
                  <a href={`${API_BASE_URL}${file.url}`} target="_blank" rel="noreferrer" title="Open the full evidence">
                    <img src={`${API_BASE_URL}${file.url}`} alt={file.name || 'Customer evidence'} />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export function DetailsModal({ row, onClose }) {
  return (
    <Modal title={`${row.reference} · ${row.issue_type_label}`} onClose={onClose} width={760}>
      <IssueDetailsBody row={row} />
    </Modal>
  )
}

// Customer issues are handled through the enquiry form, phone follow-up and internal admin work.
// Unlike merchant issues, they intentionally do not expose a chat composer.
export function CustomerIssueCaseModal({ row, onClose, onChanged, onOpenConversation }) {
  const notes = row.notes || []
  const evidence = row.attachments || []
  const callNotes = notes.filter((entry) => isCallNote(entry.note))
  const generalNotes = notes.filter((entry) => evidenceNoteFileId(entry.note) === null && !isCallNote(entry.note))
  const [note, setNote] = useState('')
  const [noteMenuOpen, setNoteMenuOpen] = useState(false)
  const [noteComposerOpen, setNoteComposerOpen] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [evidenceNoteFile, setEvidenceNoteFile] = useState(null)
  const [evidenceNote, setEvidenceNote] = useState('')
  const [savingEvidenceNote, setSavingEvidenceNote] = useState(false)
  const [callNote, setCallNote] = useState('')
  const [callNoteComposerOpen, setCallNoteComposerOpen] = useState(false)
  const [savingCallNote, setSavingCallNote] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)
  const [notifyingMerchant, setNotifyingMerchant] = useState(false)
  const [notifyConfirmOpen, setNotifyConfirmOpen] = useState(false)
  const [selectedCallNoteIds, setSelectedCallNoteIds] = useState([])
  const [toast, setToast] = useState(null)
  const [error, setError] = useState('')
  const orderLookup = row.order?.merchant_order_id || row.order_ref || ''
  const orderDetailsPath = `/dashboard/order-check?order=${encodeURIComponent(orderLookup)}`

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(null), 5000)
    return () => window.clearTimeout(timer)
  }, [toast])

  async function handleStatusChange(event) {
    setSavingStatus(true)
    setError('')
    try {
      await api.updateCustomerIssue(row.id, { status: event.target.value })
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingStatus(false)
    }
  }

  async function handleAddNote() {
    const text = note.trim()
    if (!text || savingNote) return
    setSavingNote(true)
    setError('')
    try {
      await api.addCustomerIssueNote(row.id, { note: text })
      setNote('')
      setNoteComposerOpen(false)
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingNote(false)
    }
  }

  async function handleAddEvidenceNote() {
    const text = evidenceNote.trim()
    if (!text || !evidenceNoteFile || savingEvidenceNote) return
    setSavingEvidenceNote(true)
    setError('')
    try {
      await api.addCustomerIssueNote(row.id, {
        note: `${evidenceNotePrefix(evidenceNoteFile.id)}${text}`,
      })
      setEvidenceNote('')
      setEvidenceNoteFile(null)
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingEvidenceNote(false)
    }
  }

  async function handleAddCallNote() {
    const text = callNote.trim()
    if (!text || savingCallNote) return
    setSavingCallNote(true)
    setError('')
    try {
      await api.addCustomerIssueNote(row.id, { note: `[call-note] ${text}` })
      setCallNote('')
      setCallNoteComposerOpen(false)
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingCallNote(false)
    }
  }

  async function handleNotifyMerchant() {
    if (notifyingMerchant) return
    setNotifyingMerchant(true)
    setError('')
    try {
      const result = await api.notifyCustomerIssueMerchant(row.id, { public_call_note_ids: selectedCallNoteIds })
      setNotifyConfirmOpen(false)
      if (result.portal_sent) {
        await onChanged()
        onOpenConversation?.()
      } else {
        setToast({ type: 'danger', message: 'The merchant notification could not be sent.' })
      }
    } catch (err) {
      setToast({ type: 'danger', message: err.message || 'The merchant could not be notified. Please try again.' })
    } finally {
      setNotifyingMerchant(false)
    }
  }

  return (
    <Modal
      title={
        <span className="issue-modal-title">
          <img src="/short-logo-new.png" alt="" />
          <span className="issue-modal-title-text">
            <span className="issue-modal-ref">{row.reference}</span>
            <span className="issue-modal-type">{row.issue_type_label}</span>
          </span>
        </span>
      }
      onClose={onClose}
      width={760}
    >
      <div className="cis-case-modal">
        <div className="cis-case-toolbar">
          <label className="issue-status-control">
            <span>Status</span>
            <select value={row.status} onChange={handleStatusChange} disabled={savingStatus}>
              <option value="new">New</option>
              <option value="in_progress">In progress</option>
              <option value="resolved">Resolved</option>
            </select>
          </label>
          <div className="cis-case-actions">
            <div className="cis-note-menu" onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setNoteMenuOpen(false)
            }}>
              <button type="button" className="cis-action-button cis-note-menu-toggle" aria-haspopup="menu" aria-expanded={noteMenuOpen} onClick={() => setNoteMenuOpen((open) => !open)}>
                Add note
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
              </button>
              {noteMenuOpen ? (
                <div className="cis-note-menu-popover" role="menu">
                  <button type="button" role="menuitem" onClick={() => {
                    setNoteMenuOpen(false)
                    setCallNoteComposerOpen(true)
                  }}>
                    <span className="cis-note-menu-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 3h3l1.4 4-2 1.5a15 15 0 0 0 6.1 6.1l1.5-2L21 14v3c0 2.2-1.8 4-4 4C9.3 21 3 14.7 3 7c0-2.2 1.8-4 4-4Z" /></svg></span>
                    <span><strong>Add call note</strong><small>Record a customer call discussion</small></span>
                  </button>
                  <button type="button" role="menuitem" onClick={() => {
                    setNoteMenuOpen(false)
                    setNoteComposerOpen(true)
                  }}>
                    <span className="cis-note-menu-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 3h9l3 3v15H6V3Zm9 0v4h4M9 11h6M9 15h6" /></svg></span>
                    <span><strong>Add overall note</strong><small>Save a general case note</small></span>
                  </button>
                </div>
              ) : null}
            </div>
            {row.customer_phone ? <a className="cis-action-button" href={`tel:${row.customer_phone}`}>Call customer</a> : null}
            <button
              type="button"
              className="cis-action-button"
              onClick={() => {
                setSelectedCallNoteIds([])
                setNotifyConfirmOpen(true)
              }}
              disabled={notifyingMerchant || !row.order?.merchant_id}
              title={row.order?.merchant_id ? 'Notify the responsible merchant' : 'No merchant is linked to this issue'}
            >
              {notifyingMerchant ? 'Notifying...' : 'Notify merchant'}
            </button>
          </div>
        </div>

        <section className="cis-case-summary">
          <div className="cis-case-summary-head">
            <span>Customer report</span>
          </div>
          <p>{row.description || 'No additional details were provided.'}</p>
          {evidence.length > 0 ? (
            <div className="cis-report-evidence">
              <div className="cis-report-evidence-head">
                <span>Submitted evidence</span>
                <strong>{evidence.length} file{evidence.length === 1 ? '' : 's'}</strong>
              </div>
              <div className="cis-report-evidence-grid">
                {evidence.map((file) => {
                  const fileHref = attachmentUrl(file.url)
                  const isVideo = String(file.content_type || '').startsWith('video/') || isVideoEvidence(file.name)
                  const fileNotes = notes.filter((entry) => evidenceNoteFileId(entry.note) === String(file.id))
                  return (
                    <div className={`cis-report-evidence-item ${isVideo ? 'is-video' : ''}`} key={file.id}>
                      {isVideo ? (
                        <video controls preload="metadata" src={fileHref} aria-label={file.name || 'Customer unboxing video'} />
                      ) : (
                        <a href={fileHref} target="_blank" rel="noreferrer" title="Open the full evidence">
                          <img src={fileHref} alt={file.name || 'Customer evidence'} />
                        </a>
                      )}
                      <a className="cis-report-evidence-link" href={fileHref} target="_blank" rel="noreferrer">
                        <span>{file.name || (isVideo ? 'Unboxing video' : 'Evidence file')}</span>
                        <span aria-hidden="true">↗</span>
                      </a>
                      <div className="cis-evidence-notes">
                        <div className="cis-evidence-notes-head">
                          <span>Admin evidence notes</span>
                          <button
                            type="button"
                            onClick={() => {
                              setEvidenceNote('')
                              setEvidenceNoteFile(file)
                            }}
                          >
                            Add note
                          </button>
                        </div>
                        {fileNotes.length > 0 ? (
                          <ul className="cis-evidence-note-list">
                            {fileNotes.map((entry) => (
                              <li key={entry.id}>
                                <p>{evidenceNoteText(entry.note)}</p>
                                <span>{entry.admin_name || 'Admin'} · {formatDate(entry.created_at)}</span>
                              </li>
                            ))}
                          </ul>
                        ) : <p className="cis-evidence-note-empty">No notes added for this evidence.</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}
        </section>

        <section className="cis-case-section">
          <div className="cis-case-section-head">
            <div><span>Order investigation</span></div>
          </div>
          <div className="cis-tracking-grid">
            <div>
              <span>Order ID</span>
              <strong><Link className="cis-identifier-link" to={orderDetailsPath}>{orderLookup || '-'}</Link></strong>
            </div>
            <div>
              <span>AWB</span>
              <strong>{row.order?.awb ? <Link className="cis-identifier-link" to={`/dashboard/order-check?order=${encodeURIComponent(row.order.awb)}`}>{row.order.awb}</Link> : 'Not available'}</strong>
            </div>
            <div><span>Courier</span><CourierLabel courier={row.order?.courier} /></div>
            <div>
              <span>Delivery status</span>
              {row.order?.delivery_status ? <strong><span className={`status-pill ${deliveryStatusClass(row.order.delivery_status)}`}>{pretty(row.order.delivery_status)}</span></strong> : <strong>Not available</strong>}
            </div>
          </div>
        </section>

        <section className="cis-case-section cis-call-notes">
          <div className="cis-case-section-head">
            <div>
              <div className="cis-section-eyebrow"><span>Admin &amp; Public</span></div>
              <h3>Call notes ({callNotes.length})</h3>
            </div>
            <button type="button" className="cis-section-note-button" onClick={() => setCallNoteComposerOpen(true)}>Add call note</button>
          </div>
          {callNotes.length > 0 ? (
            <ul className="issue-note-list">
              {callNotes.map((entry) => (
                <li key={entry.id}>
                  <p>{callNoteText(entry.note)}</p>
                  <span>{entry.admin_name || 'Admin'} · {formatDate(entry.created_at)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="sr-empty">No customer call notes yet.</p>}
        </section>

        <section className="cis-case-section cis-admin-notes">
          <div className="cis-case-section-head">
            <div><span>Admin only</span><h3>Overall notes ({generalNotes.length})</h3></div>
            <button type="button" className="cis-section-note-button" onClick={() => setNoteComposerOpen(true)}>Add overall note</button>
          </div>
          {generalNotes.length > 0 ? (
            <ul className="issue-note-list">
              {generalNotes.map((entry) => (
                <li key={entry.id}>
                  <p>{entry.note}</p>
                  <span>{entry.admin_name || 'Admin'} · {formatDate(entry.created_at)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="sr-empty">No overall notes yet.</p>}
        </section>

        {noteComposerOpen ? (
          <div
            className="cis-note-composer-overlay"
            onMouseDown={(event) => {
              event.stopPropagation()
              if (event.target === event.currentTarget && !savingNote) setNoteComposerOpen(false)
            }}
          >
            <div className="cis-note-composer" role="dialog" aria-modal="true" aria-labelledby="cis-note-composer-title">
              <div className="cis-note-composer-head">
                <div>
                  <span>Admin only</span>
                  <h3 id="cis-note-composer-title">Add internal note</h3>
                </div>
                <button type="button" className="modal-close" onClick={() => setNoteComposerOpen(false)} disabled={savingNote} aria-label="Close note editor">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
                </button>
              </div>
              <textarea autoFocus rows={5} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Write a private note for the admin team" />
              <div className="cis-note-composer-actions">
                <button type="button" className="contact-reply-btn" onClick={handleAddNote} disabled={savingNote || !note.trim()}>
                  {savingNote ? 'Saving...' : 'Save note'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {notifyConfirmOpen ? (
          <div
            className="cis-note-composer-overlay"
            onMouseDown={(event) => {
              event.stopPropagation()
              if (event.target === event.currentTarget && !notifyingMerchant) setNotifyConfirmOpen(false)
            }}
          >
            <div className="cis-note-composer cis-notify-merchant-dialog" role="dialog" aria-modal="true" aria-labelledby="cis-notify-merchant-title">
              <div className="cis-note-composer-head">
                <div>
                  <span>Merchant notification</span>
                  <h3 id="cis-notify-merchant-title">Notify {row.order?.merchant_name || 'merchant'}</h3>
                </div>
                <button type="button" className="modal-close" onClick={() => setNotifyConfirmOpen(false)} disabled={notifyingMerchant} aria-label="Close merchant notification">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
                </button>
              </div>
              <p className="cis-notify-description">The customer report and standard notification will be sent. Select any public call notes you also want to share with the merchant.</p>
              <div className="cis-public-note-picker">
                <div className="cis-public-note-picker-head">
                  <strong>Public call notes</strong>
                  <span>{selectedCallNoteIds.length} selected</span>
                </div>
                {callNotes.length > 0 ? (
                  <div className="cis-public-note-options">
                    {callNotes.map((entry) => (
                      <label key={entry.id}>
                        <input
                          type="checkbox"
                          checked={selectedCallNoteIds.includes(entry.id)}
                          onChange={() => setSelectedCallNoteIds((current) => (
                            current.includes(entry.id)
                              ? current.filter((id) => id !== entry.id)
                              : [...current, entry.id]
                          ))}
                        />
                        <span>
                          <strong>{callNoteText(entry.note)}</strong>
                          <small>{entry.admin_name || 'Admin'} · {formatDate(entry.created_at)}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                ) : <p className="cis-public-note-empty">No public call notes have been saved. You can still notify the merchant without one.</p>}
              </div>
              <div className="cis-note-composer-actions">
                <button type="button" className="contact-reply-btn" onClick={handleNotifyMerchant} disabled={notifyingMerchant}>
                  {notifyingMerchant ? 'Notifying...' : selectedCallNoteIds.length ? `Notify with ${selectedCallNoteIds.length} call note${selectedCallNoteIds.length === 1 ? '' : 's'}` : 'Notify merchant'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {callNoteComposerOpen ? (
          <div
            className="cis-note-composer-overlay"
            onMouseDown={(event) => {
              event.stopPropagation()
              if (event.target === event.currentTarget && !savingCallNote) setCallNoteComposerOpen(false)
            }}
          >
            <div className="cis-note-composer" role="dialog" aria-modal="true" aria-labelledby="cis-call-note-title">
              <div className="cis-note-composer-head">
                <div>
                  <span>Admin only · Customer call</span>
                  <h3 id="cis-call-note-title">Add call note</h3>
                </div>
                <button type="button" className="modal-close" onClick={() => setCallNoteComposerOpen(false)} disabled={savingCallNote} aria-label="Close call note editor">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
                </button>
              </div>
              <textarea autoFocus rows={5} maxLength={2000} value={callNote} onChange={(event) => setCallNote(event.target.value)} placeholder="Write what was discussed with the customer during the call" />
              <div className="cis-note-composer-actions">
                <button type="button" className="contact-reply-btn" onClick={handleAddCallNote} disabled={savingCallNote || !callNote.trim()}>
                  {savingCallNote ? 'Saving...' : 'Save call note'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {evidenceNoteFile ? (
          <div
            className="cis-note-composer-overlay"
            onMouseDown={(event) => {
              event.stopPropagation()
              if (event.target === event.currentTarget && !savingEvidenceNote) setEvidenceNoteFile(null)
            }}
          >
            <div className="cis-note-composer" role="dialog" aria-modal="true" aria-labelledby="cis-evidence-note-title">
              <div className="cis-note-composer-head">
                <div>
                  <span>Admin only · Evidence</span>
                  <h3 id="cis-evidence-note-title">Add evidence note</h3>
                </div>
                <button type="button" className="modal-close" onClick={() => setEvidenceNoteFile(null)} disabled={savingEvidenceNote} aria-label="Close evidence note editor">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
                </button>
              </div>
              <p className="cis-evidence-note-file">{evidenceNoteFile.name || 'Submitted evidence'}</p>
              <textarea autoFocus rows={5} maxLength={2000} value={evidenceNote} onChange={(event) => setEvidenceNote(event.target.value)} placeholder="Write a private note about this evidence" />
              <div className="cis-note-composer-actions">
                <button type="button" className="contact-reply-btn" onClick={handleAddEvidenceNote} disabled={savingEvidenceNote || !evidenceNote.trim()}>
                  {savingEvidenceNote ? 'Saving...' : 'Save note'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {error ? <div className="error-banner">{error}</div> : null}
        {toast ? (
          <div className={`needs-toast needs-toast-${toast.type}`} role="status" aria-live="polite">
            {toast.message}
            <button type="button" onClick={() => setToast(null)} aria-label="Dismiss notification">×</button>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}

function MerchantConversationModal({ row, onClose, onChanged }) {
  const [messages, setMessages] = useState(() => (row.messages || []).filter((message) => message.channel === 'merchant' && (message.sender === 'merchant' || message.sender === 'admin')))
  const [draft, setDraft] = useState('')
  const [files, setFiles] = useState([])
  const [publicNotePickerOpen, setPublicNotePickerOpen] = useState(false)
  const [selectedPublicNoteIds, setSelectedPublicNoteIds] = useState([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)
  const merchantName = row.order?.merchant_name || 'Merchant'
  const emailSubject = `Customer issue ${row.reference} · Order ${row.order?.merchant_order_id || row.order_ref}`
  const publicCallNotes = (row.notes || []).filter((entry) => isCallNote(entry.note))

  async function handleSend(event) {
    event.preventDefault()
    const body = draft.trim()
    const selectedNotes = publicCallNotes.filter((entry) => selectedPublicNoteIds.includes(entry.id))
    if ((!body && files.length === 0 && selectedNotes.length === 0) || sending) return
    setSending(true)
    setError('')
    try {
      const form = new FormData()
      const publicNotesBlock = selectedNotes.length
        ? `Public call notes shared by EscroSafe:\n\n${selectedNotes.map((entry, index) => `${index + 1}. ${callNoteText(entry.note)}`).join('\n')}`
        : ''
      form.append('body', [body, publicNotesBlock].filter(Boolean).join('\n\n'))
      form.append('channel', 'merchant')
      files.forEach((file) => form.append('attachments', file))
      const updated = await api.sendCustomerIssueMessage(row.id, form)
      setMessages((updated.messages || []).filter((message) => message.channel === 'merchant' && (message.sender === 'merchant' || message.sender === 'admin')))
      setDraft('')
      setFiles([])
      setSelectedPublicNoteIds([])
      if (fileInputRef.current) fileInputRef.current.value = ''
      onChanged()
    } catch (requestError) {
      setError(requestError.message || 'The reply could not be sent.')
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal
      title={
        <span className="issue-modal-title">
          <img src="/short-logo-new.png" alt="" />
          <span className="issue-modal-title-text">
            <span className="issue-modal-ref">Email thread · {row.reference}</span>
            <span className="issue-modal-type">{merchantName} · {row.order?.merchant_order_id || row.order_ref}</span>
          </span>
        </span>
      }
      onClose={onClose}
      width={760}
    >
      <div className="issue-chat-modal cis-merchant-conversation">
        <div className="issue-email-thread-subject"><span>Subject</span><h3>{emailSubject}</h3><small>{messages.length + 1} message{messages.length === 0 ? '' : 's'}</small></div>
        <div className="issue-chat-body issue-email-thread" aria-live="polite">
          <div className="issue-chat-item cis-customer-report-message">
            <div className="issue-chat-day"><span>{dayLabel(row.created_at)}</span></div>
            <article className="issue-email-message is-outbound cis-customer-report-bubble">
              <header className="issue-email-message-head">
                <EscroSafeAvatar />
                <div className="issue-email-sender"><strong>EscroSafe Customer Support</strong><small>To: {merchantName}</small></div>
                <time>{timeLabel(row.created_at)}</time>
              </header>
              <div className="issue-email-content">
                <p className="issue-email-label">Customer report</p>
                <p>{row.description || 'No additional details were provided.'}</p>
                {(row.attachments || []).length ? (
                  <div className="cis-conversation-report-evidence">
                    <span className="cis-conversation-evidence-label">Attachments · {row.attachments.length}</span>
                    <div className="cis-report-evidence-grid">
                      {row.attachments.map((file) => {
                        const fileHref = attachmentUrl(file.url)
                        const isVideo = String(file.content_type || '').startsWith('video/') || isVideoEvidence(file.name)
                        const isImage = isImageAttachment(file)
                        return (
                          <div className={`cis-report-evidence-item ${isVideo ? 'is-video' : ''}`} key={file.id}>
                            {isVideo ? (
                              <video controls preload="metadata" src={fileHref} aria-label={file.name || 'Customer video'} />
                            ) : isImage ? (
                              <a href={fileHref} target="_blank" rel="noreferrer" title="Open the full evidence">
                                <img src={fileHref} alt={file.name || 'Customer evidence'} />
                              </a>
                            ) : null}
                            <a className="cis-report-evidence-link" href={fileHref} target="_blank" rel="noreferrer">
                              <span>{file.name || (isVideo ? 'Customer video' : 'Evidence file')}</span>
                              <span aria-hidden="true">↗</span>
                            </a>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </article>
          </div>
          {messages.map((message, index) => {
            const fromAdmin = message.sender === 'admin'
            const previousDate = index === 0 ? row.created_at : messages[index - 1].created_at
            const startsNewDay = dayKey(message.created_at) !== dayKey(previousDate)
            return (
              <div key={message.id} className="issue-chat-item">
                {startsNewDay ? <div className="issue-chat-day"><span>{dayLabel(message.created_at)}</span></div> : null}
                <article className={`issue-email-message ${fromAdmin ? 'is-outbound' : 'is-inbound'}`}>
                  <header className="issue-email-message-head">
                    {fromAdmin ? <EscroSafeAvatar /> : <PersonAvatar />}
                    <div className="issue-email-sender">
                      <strong>{fromAdmin ? `EscroSafe${message.admin_name ? ` · ${message.admin_name}` : ' Customer Support'}` : message.sender_name || merchantName}</strong>
                      <small>To: {fromAdmin ? merchantName : 'EscroSafe Support'}</small>
                    </div>
                    <time>{timeLabel(message.created_at)}</time>
                  </header>
                  <div className="issue-email-content">
                    {message.body ? <p>{message.body}</p> : null}
                    {(message.attachments || []).length ? (
                      <div className="cis-message-attachments">
                        {message.attachments.map((attachment) => (
                          isImageAttachment(attachment) ? (
                            <a key={attachment.id} className="cis-message-image" href={attachmentUrl(attachment.url)} target="_blank" rel="noreferrer">
                              <img src={attachmentUrl(attachment.url)} alt={attachment.name || 'Merchant attachment'} />
                              <span>{attachment.name || 'Image attachment'}</span>
                            </a>
                          ) : (
                            <a key={attachment.id} href={attachmentUrl(attachment.url)} target="_blank" rel="noreferrer">
                              <span aria-hidden="true">↗</span>
                              <span>{attachment.name || 'Attachment'}</span>
                            </a>
                          )
                        ))}
                      </div>
                    ) : null}
                  </div>
                </article>
              </div>
            )
          })}
        </div>
        {error ? <div className="error-banner">{error}</div> : null}
        <form className="issue-email-compose" onSubmit={handleSend}>
          <div className="issue-email-reply-label"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 17-6-5 6-5M4 12h8c5 0 8 2 8 7" /></svg><strong>Reply</strong><span>to {merchantName}</span></div>
          <textarea rows={4} maxLength={2000} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write your reply…" aria-label="Reply to merchant" />
          {files.length ? <div className="issue-email-selected-files">{files.map((file, index) => <span key={`${file.name}-${file.lastModified}-${index}`}><strong>{file.name}</strong><button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}>×</button></span>)}</div> : null}
          {selectedPublicNoteIds.length ? <div className="issue-email-selected-public-notes"><strong>{selectedPublicNoteIds.length} public call note{selectedPublicNoteIds.length === 1 ? '' : 's'} attached</strong><button type="button" onClick={() => setSelectedPublicNoteIds([])}>Remove</button></div> : null}
          <div className="issue-email-compose-actions">
            <div className="issue-email-compose-tools">
              <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" multiple hidden onChange={(event) => setFiles(Array.from(event.target.files || []).slice(0, 4))} />
              <button type="button" className="issue-email-attach" onClick={() => fileInputRef.current?.click()}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21.4 11.6-8.9 8.9a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" /></svg><span>Attach files</span></button>
              <button type="button" className="issue-email-attach issue-email-attach-notes" onClick={() => setPublicNotePickerOpen(true)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l3 3v15H6V3Zm9 0v4h4M9 11h6M9 15h6" /></svg><span>Attach public notes</span></button>
            </div>
            <button type="submit" disabled={sending || (!draft.trim() && files.length === 0 && selectedPublicNoteIds.length === 0)}>{sending ? 'Sending…' : 'Send message'}</button>
          </div>
        </form>
        {publicNotePickerOpen ? (
          <div className="cis-note-composer-overlay" onMouseDown={(event) => {
            event.stopPropagation()
            if (event.target === event.currentTarget) setPublicNotePickerOpen(false)
          }}>
            <div className="cis-note-composer cis-notify-merchant-dialog" role="dialog" aria-modal="true" aria-labelledby="cis-attach-public-notes-title">
              <div className="cis-note-composer-head">
                <div><span>Merchant message</span><h3 id="cis-attach-public-notes-title">Attach public call notes</h3></div>
                <button type="button" className="modal-close" onClick={() => setPublicNotePickerOpen(false)} aria-label="Close public notes picker"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
              </div>
              <p className="cis-notify-description">Choose the call notes to include in this message to {merchantName}.</p>
              <div className="cis-public-note-picker">
                <div className="cis-public-note-picker-head"><strong>Public call notes</strong><span>{selectedPublicNoteIds.length} selected</span></div>
                {publicCallNotes.length ? <div className="cis-public-note-options">{publicCallNotes.map((entry) => (
                  <label key={entry.id}>
                    <input type="checkbox" checked={selectedPublicNoteIds.includes(entry.id)} onChange={() => setSelectedPublicNoteIds((current) => current.includes(entry.id) ? current.filter((id) => id !== entry.id) : [...current, entry.id])} />
                    <span><strong>{callNoteText(entry.note)}</strong><small>{entry.admin_name || 'Admin'} · {formatDate(entry.created_at)}</small></span>
                  </label>
                ))}</div> : <p className="cis-public-note-empty">No public call notes are available.</p>}
              </div>
              <div className="cis-note-composer-actions"><button type="button" className="contact-reply-btn" onClick={() => setPublicNotePickerOpen(false)}>Attach selected notes</button></div>
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}

export default function CustomerIssuesPage() {
  const [rows, setRows] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 25
  const [searchParams] = useSearchParams()
  const [q, setQ] = useState(searchParams.get('q') || '')
  const merchantId = searchParams.get('merchant_id') || ''
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [chatId, setChatId] = useState(Number(searchParams.get('chat')) || null)
  const [conversationId, setConversationId] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    return api
      .customerIssues({ page, limit, q, status: statusFilter, type: typeFilter, merchant_id: merchantId })
      .then((data) => {
        setRows(data.results || [])
        setTotalPages(data.total_pages || 1)
        setTotal(data.total || 0)
        setError('')
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [page, limit, q, statusFilter, typeFilter, merchantId])

  useEffect(() => {
    load()
  }, [load])

  function handleSearch(event) {
    event.preventDefault()
    setPage(1)
    setQ(event.target.elements.search.value)
  }

  function handleOpenConversation(row) {
    setConversationId(row.id)
    if (!row.merchant_response_unread) return

    setRows((current) => current.map((item) => (
      item.id === row.id
        ? { ...item, merchant_response_unread: false, merchant_response_unread_count: 0 }
        : item
    )))
    api.updateCustomerIssue(row.id, { merchant_messages_read: true }).catch(() => load())
  }


  const chatRow = rows.find((row) => row.id === chatId) || null
  const conversationRow = rows.find((row) => row.id === conversationId) || null
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1)

  return (
    <div className="audit-page">
      <div className="panel-card audit-surface">
        <div className="section-title audit-section-title">
          <div className="section-title-left">
            <span className="orders-section-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="8.5" r="3.6" />
                <path d="M4.5 20c.5-4 3.5-6.2 7.5-6.2s7 2.2 7.5 6.2" />
              </svg>
            </span>
            Customer issues
          </div>
        </div>
        <p className="contact-intro">Review customer reports, track the shipment, arrange a call, update status and keep private admin notes.</p>

        <form className="toolbar audit-toolbar" onSubmit={handleSearch}>
          <div className="toolbar-field">
            <label htmlFor="cis-search">Search:</label>
            <input id="cis-search" name="search" placeholder="CIS-00012, customer, order ID or text" defaultValue={q} />
          </div>
          <div className="toolbar-field">
            <label htmlFor="cis-status">Status:</label>
            <select
              id="cis-status"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value)
                setPage(1)
              }}
            >
              {STATUS_FILTERS.map((status) => (
                <option key={status.value || 'all'} value={status.value}>{status.label}</option>
              ))}
            </select>
          </div>
          <div className="toolbar-field">
            <label htmlFor="cis-type">Issue:</label>
            <select
              id="cis-type"
              value={typeFilter}
              onChange={(event) => {
                setTypeFilter(event.target.value)
                setPage(1)
              }}
            >
              <option value="">All issue types</option>
              {ISSUE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
          <button type="submit">Search</button>
          <button type="button" onClick={load}>Refresh</button>
        </form>

        {error && <div className="error-banner">{error}</div>}

        <div className="table-wrap audit-table-wrap">
          <table className="audit-table issue-table customer-issues-table">
            <thead>
              <tr>
                <th>Ticket number</th>
                <th>Received</th>
                <th>Customer</th>
                <th>Order ID</th>
                <th>Merchant</th>
                <th>Payment ID</th>
                <th>Type</th>
                <th>Status</th>
                <th>Details</th>
                <th>Merchant response</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={10} className="empty-row">Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={10} className="empty-row">No customer issues yet.</td></tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className={row.awaiting_reply && row.status !== 'resolved' ? 'contact-row-new' : ''}>
                    <td><span className="cell-strong">{row.reference}</span></td>
                    <td><span className="cell-muted">{formatDate(row.created_at)}</span></td>
                    <td>
                      <div className="cell-strong">{row.customer_name}</div>
                      <div className="cell-muted">{row.customer_phone || row.customer_email || ''}</div>
                    </td>
                    <td>
                      <Link
                        className="orders-data-link orders-payment-id-link cis-order-id-link"
                        to={`/dashboard/order-check?order=${encodeURIComponent(row.order?.merchant_order_id || row.order_ref)}`}
                        title="Open the associated order"
                      >
                        {row.order?.merchant_order_id || row.order_ref}
                      </Link>
                    </td>
                    <td>
                      <div className="cell-muted">
                        {row.order?.merchant_id
                          ? <Link className="merchant-history-link" to={`/dashboard/merchants/${row.order.merchant_id}`}>{row.order.merchant_name || 'Merchant'}</Link>
                          : row.order?.merchant_order_id
                          ? `${row.order.merchant_name || 'Order found'}${row.order.delivery_status ? ` · ${pretty(row.order.delivery_status)}` : ''}`
                          : 'Order not found'}
                      </div>
                    </td>
                    <td>
                      {row.order?.payment_id ? (
                        <Link
                          className="merchant-history-link cell-single-line"
                          to={`/dashboard/order-check?order=${encodeURIComponent(row.order?.merchant_order_id || row.order_ref)}`}
                          title="Open the associated order"
                        >
                          {row.order.payment_id}
                        </Link>
                      ) : <span className="cell-strong cell-single-line">-</span>}
                    </td>
                    <td>
                      <span className="issue-type-cell">{row.issue_type_label}</span>
                    </td>
                    <td>
                      <span className={`status-pill ${STATUS_PILL_CLASS[row.status] || ''}`}>{row.status_label}</span>
                    </td>
                    <td>
                      <button type="button" className="table-action-link" onClick={() => setChatId(row.id)}>Open</button>
                    </td>
                    <td>
                      <div className="cis-merchant-response-cell">
                        <button
                          type="button"
                          className="table-action-link cis-conversation-button"
                          aria-label={row.merchant_response_unread ? 'Conversation, unread merchant message' : 'Conversation'}
                          onClick={() => handleOpenConversation(row)}
                        >
                          Conversation
                          {row.merchant_response_unread ? <span className="cis-conversation-alert" aria-hidden="true" /> : null}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="contact-pagination">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
          {pageNumbers.map((pageNumber) => (
            <button
              key={pageNumber}
              type="button"
              className={pageNumber === page ? 'is-active' : ''}
              onClick={() => setPage(pageNumber)}
            >
              {pageNumber}
            </button>
          ))}
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      </div>
      {chatRow && <CustomerIssueCaseModal key={chatRow.id} row={chatRow} onClose={() => setChatId(null)} onChanged={load} onOpenConversation={() => {
        setChatId(null)
        setConversationId(chatRow.id)
      }} />}
      {conversationRow && <MerchantConversationModal key={conversationRow.id} row={conversationRow} onClose={() => setConversationId(null)} onChanged={load} />}
    </div>
  )
}
