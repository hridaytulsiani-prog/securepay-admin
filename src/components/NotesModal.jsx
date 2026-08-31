// Full note history for one enquiry: add a new note, edit or delete an
// existing one. Opened from the "View notes" / "Add note" link in the
// Enquiries table's pinned Notes column.
import { useEffect, useState } from 'react'
import Modal from './Modal'
import { api } from '../api/client'

export default function NotesModal({ enquiry, onClose, onChanged }) {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editDraft, setEditDraft] = useState('')

  function load() {
    setLoading(true)
    api
      .enquiryNotes(enquiry.id)
      .then((data) => setNotes(data.results))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // load() is stable enough here (only reads enquiry.id via closure) —
    // re-running it on every render would just cause flicker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enquiry.id])

  async function handleAdd(e) {
    e.preventDefault()
    if (!draft.trim()) return
    setSubmitting(true)
    setError('')
    try {
      await api.addEnquiryNote(enquiry.id, draft.trim())
      setDraft('')
      load()
      // Tell the parent table to refetch too, so its "latest note" preview
      // and notes_count badge update without closing this modal.
      onChanged?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  function startEdit(note) {
    setEditingId(note.id)
    setEditDraft(note.note)
  }

  async function handleUpdate(e) {
    e.preventDefault()
    if (!editDraft.trim()) return
    setSubmitting(true)
    setError('')
    try {
      await api.updateEnquiryNote(enquiry.id, editingId, editDraft.trim())
      setEditingId(null)
      load()
      onChanged?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(noteId) {
    setSubmitting(true)
    setError('')
    try {
      await api.deleteEnquiryNote(enquiry.id, noteId)
      load()
      onChanged?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={`Notes — ${enquiry.enquiry_id}`} onClose={onClose} width={560}>
      <form className="note-composer" onSubmit={handleAdd}>
        <textarea
          rows={3}
          placeholder="Add a note about this enquiry…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" disabled={submitting || !draft.trim()}>
          Add note
        </button>
      </form>

      {error && <div className="error-banner">{error}</div>}

      <div className="note-list">
        {loading ? (
          <div className="empty-row">Loading notes…</div>
        ) : notes.length === 0 ? (
          <div className="empty-row">No notes yet.</div>
        ) : (
          notes.map((note) => (
            <div key={note.id} className="note-item">
              {editingId === note.id ? (
                <form onSubmit={handleUpdate} className="note-edit-form">
                  <textarea rows={3} value={editDraft} onChange={(e) => setEditDraft(e.target.value)} />
                  <div className="note-edit-actions">
                    <button type="submit" disabled={submitting}>
                      Save
                    </button>
                    <button type="button" onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="note-text">{note.note}</div>
                  <div className="note-meta">
                    <span>
                      {note.created_by || 'admin'} · {new Date(note.created_at).toLocaleString()}
                      {note.updated_at !== note.created_at ? ' (edited)' : ''}
                    </span>
                    <span className="note-actions">
                      <button type="button" onClick={() => startEdit(note)}>
                        Edit
                      </button>
                      <button type="button" onClick={() => handleDelete(note.id)}>
                        Delete
                      </button>
                    </span>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </Modal>
  )
}
