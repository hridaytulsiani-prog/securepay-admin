// Small pieces shared by the order report and the order check pages: the tag icon and the internal-notes box.
function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '-'
}

export function TagIcon() {
  return (
    <svg className="ir-tag" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" />
      <circle cx="7.5" cy="7.5" r="1.3" />
    </svg>
  )
}

export function NotesBlock({ title, notes }) {
  return (
    <div className="ir-notes">
      <h4>{title}</h4>
      {notes.length === 0 ? <p className="sr-empty">No internal notes yet.</p> : null}
      {notes.map((item, index) => (
        <blockquote className="ir-quote is-ours" key={index}>
          {item.note}
          <footer>{[item.by || 'Admin', item.source, formatDate(item.created_at)].filter(Boolean).join(' · ')}</footer>
        </blockquote>
      ))}
    </div>
  )
}
