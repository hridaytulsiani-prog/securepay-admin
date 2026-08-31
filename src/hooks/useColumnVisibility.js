// Per-table "which columns are shown" state, persisted to localStorage so
// an admin's column choices survive a page reload. Used by OrdersPage and
// EnquiriesPage together with <ColumnPicker>.
import { useEffect, useState } from 'react'

export function useColumnVisibility(storageKey, columns) {
  const allKeys = columns.map((c) => c.key)

  const [visible, setVisible] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey))
      // Filter saved keys against the current column list so a stale/renamed
      // column from an older version of the app can't leave a broken entry.
      if (Array.isArray(saved) && saved.length) {
        return allKeys.filter((k) => saved.includes(k))
      }
    } catch {
      // ignore malformed storage
    }
    return allKeys
  })

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(visible))
    } catch {
      // ignore storage failures (private mode, quota, etc.)
    }
  }, [storageKey, visible])

  function toggle(key) {
    setVisible((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  function showAll() {
    setVisible(allKeys)
  }

  function hideAll() {
    setVisible([])
  }

  const visibleColumns = columns.filter((c) => visible.includes(c.key))

  return { visible, toggle, showAll, hideAll, visibleColumns }
}
