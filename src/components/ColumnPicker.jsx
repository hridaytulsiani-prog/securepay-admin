// "Columns (n/m)" dropdown button — lets an admin show/hide table columns.
// Paired with the useColumnVisibility hook, which owns the actual state.
import { useEffect, useRef, useState } from 'react'

export default function ColumnPicker({ columns, visible, onToggle, onShowAll, onHideAll }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Close the popover on any click outside it, like a native <select>.
  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="column-picker" ref={ref}>
      <button type="button" className="column-picker-toggle" onClick={() => setOpen((v) => !v)}>
        Columns ({visible.length}/{columns.length})
      </button>
      {open && (
        <div className="column-picker-menu">
          <div className="column-picker-actions">
            <button type="button" onClick={onShowAll}>
              Show all
            </button>
            <button type="button" onClick={onHideAll}>
              Hide all
            </button>
          </div>
          <div className="column-picker-list">
            {columns.map((col) => (
              <label key={col.key} className="column-picker-item">
                <input
                  type="checkbox"
                  checked={visible.includes(col.key)}
                  onChange={() => onToggle(col.key)}
                />
                {col.label}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
