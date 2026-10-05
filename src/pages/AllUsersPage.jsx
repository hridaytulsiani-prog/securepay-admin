import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import Modal from '../components/Modal'
import { useAuth } from '../context/AuthContext'
import { ROLE_OPTIONS } from '../utils/roles'

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '-'
}

export default function AllUsersPage() {
  const { admin } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [accessUser, setAccessUser] = useState(null)
  const [search, setSearch] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    api
      .adminUsers()
      .then((data) => {
        setUsers(data.results || [])
        setError('')
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleRoleChange(user, role) {
    setSavingId(user.id)
    setError('')
    setSuccess('')
    try {
      await api.updateAdminUserRole(user.id, role)
      setSuccess(`Updated ${user.username}'s role.`)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingId(null)
    }
  }

  async function handleDelete(user) {
    const confirmed = window.confirm(`Delete admin account "${user.username}"?`)
    if (!confirmed) return

    setSavingId(user.id)
    setError('')
    setSuccess('')
    try {
      await api.deleteAdminUser(user.id)
      setSuccess(`Deleted ${user.username}.`)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingId(null)
    }
  }

  function handleSearch(event) {
    event.preventDefault()
    setSearch(event.target.elements.search.value.trim())
  }

  const filteredUsers = users.filter((user) => {
    const haystack = `${user.username || ''} ${user.email || ''} ${user.role || ''}`.toLowerCase()
    return haystack.includes(search.toLowerCase())
  })

  return (
    <div className="users-page">
      <div className="panel-card users-surface">
        <div className="section-title users-section-title">
          <div className="section-title-left">
            <span className="orders-section-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7-1.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3.5 18.5a5 5 0 0 1 10 0v1h-10v-1Zm11 1v-1a4 4 0 0 0-1.1-2.75 4.5 4.5 0 0 1 7.1 3.75h-6Z" />
              </svg>
            </span>
            Users <span className="count-badge">{users.length}</span>
          </div>
        </div>

        <form className="toolbar users-toolbar" onSubmit={handleSearch}>
          <div className="toolbar-field">
            <label htmlFor="user-search">Search users:</label>
            <input
              id="user-search"
              name="search"
              placeholder="username, email, role..."
              defaultValue={search}
            />
          </div>
          <button type="submit">Search</button>
          <button type="button" className="users-refresh-button" onClick={load}>
            Refresh
          </button>
        </form>

        {error && <div className="error-banner">{error}</div>}
        {success && <div className="success-banner users-success">{success}</div>}

        <div className="table-wrap users-table-wrap">
          <table className="users-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Created At</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="empty-row">Loading users...</td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-row">No admin users found.</td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="cell-strong">{user.username}</div>
                      <div className="cell-muted">ID: {user.id}</div>
                    </td>
                    <td>{user.email || '-'}</td>
                    <td>
                      <select
                        className="role-select"
                        value={user.role}
                        onChange={(e) => handleRoleChange(user, e.target.value)}
                        disabled={savingId === user.id}
                      >
                        {ROLE_OPTIONS.map((role) => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td><span className="cell-muted">{formatDate(user.created_at)}</span></td>
                    <td>
                      <span className={`status-pill ${user.is_active ? 'status-success' : 'status-failed'}`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="table-action-link users-action-button"
                        onClick={() => setAccessUser(user)}
                        disabled={savingId === user.id}
                      >
                        Edit Access
                      </button>
                      <button
                        type="button"
                        className="danger-link-button"
                        onClick={() => handleDelete(user)}
                        disabled={savingId === user.id || user.id === admin?.id}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {accessUser && (
        <AccessModal
          user={accessUser}
          onClose={() => setAccessUser(null)}
          onSaved={() => {
            setSuccess(`Updated ${accessUser.username}'s special access.`)
            setAccessUser(null)
            load()
          }}
          onError={setError}
        />
      )}
    </div>
  )
}

function AccessModal({ user, onClose, onSaved, onError }) {
  const [rules, setRules] = useState(() => {
    const next = {}
    ;(user.special_access || []).forEach((item) => {
      next[item.key] = {
        enabled: Boolean(item.enabled),
        hourly_limit: item.hourly_limit ?? item.default_hourly_limit ?? 10,
        inherited: Boolean(item.inherited),
      }
    })
    return next
  })
  const [submitting, setSubmitting] = useState(false)

  function updateRule(key, patch) {
    setRules((current) => ({
      ...current,
      [key]: {
        ...(current[key] || {}),
        ...patch,
      },
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    onError('')
    try {
      await api.updateAdminUserAccess(user.id, rules)
      onSaved()
    } catch (err) {
      onError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={`Edit Access - ${user.username}`} onClose={onClose} width={760}>
      <form className="access-form" onSubmit={handleSubmit}>
        <div className="access-list">
          {(user.special_access || []).map((item) => {
            const current = rules[item.key] || {}
            return (
              <div className="access-row" key={item.key}>
                <label className="access-toggle">
                  <input
                    type="checkbox"
                    checked={Boolean(current.enabled)}
                    disabled={Boolean(item.inherited)}
                    onChange={(e) => updateRule(item.key, { enabled: e.target.checked })}
                  />
                  <span>
                    <strong>
                      {item.label}
                      {item.inherited ? <em>Included by role</em> : null}
                    </strong>
                    <small>{item.description}</small>
                  </span>
                </label>
                {item.has_hourly_limit ? (
                  <div className="access-limit">
                    <label htmlFor={`limit-${item.key}`}>Per hour limit</label>
                    <input
                      id={`limit-${item.key}`}
                      type="number"
                      min={0}
                      value={current.hourly_limit ?? item.default_hourly_limit ?? 10}
                      onChange={(e) => updateRule(item.key, { hourly_limit: Number(e.target.value) })}
                    />
                  </div>
                ) : (
                  <div className="cell-muted">No hourly limit</div>
                )}
              </div>
            )
          })}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Updating...' : 'Update Access'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
