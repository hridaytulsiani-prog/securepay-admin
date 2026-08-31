// Generic modal shell (overlay + card + header/close button) used by
// NotesModal and ResolutionModal. Portals to document.body so it isn't
// clipped by the table's own overflow/scroll containers.
import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function Modal({ title, onClose, children, width = 480 }) {
  // Esc closes the modal from anywhere, not just the visible close button.
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return createPortal(
    // Clicking the dimmed backdrop closes the modal; stopPropagation on the
    // card itself stops that same click from bubbling up and closing it.
    <div className="modal-overlay" onMouseDown={onClose}>
      <div
        className="modal-card"
        style={{ maxWidth: width }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>{title}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body
  )
}
