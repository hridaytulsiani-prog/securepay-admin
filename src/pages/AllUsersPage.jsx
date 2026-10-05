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

  return (
    <div>
      <h1>SecurePay - All Users</h1>

      <div className="panel-card">
        <div className="section-title">
          <div className="section-title-left">
            Admin Users <span className="count-badge">{users.length}</span>
          </div>
          <button type="button" className="btn-secondary" onClick={load}>
            Refresh
          </button>
        </div>

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
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-row">No admin users found.</td>
                </tr>
              ) : (
                users.map((user) => (
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
