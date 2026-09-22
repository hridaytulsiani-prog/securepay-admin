import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { ROLE_OPTIONS, ROLE_OWNER } from '../utils/roles'

export default function CreateAdminAccountPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    setupKey: '',
    role: ROLE_OWNER,
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [createdAdmin, setCreatedAdmin] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setCreatedAdmin(null)
    setSubmitting(true)
    try {
      const data = await api.createAdminAccount({
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        confirm_password: form.confirmPassword,
        setup_key: form.setupKey,
        role: form.role,
      })
      setSuccess(data.message || 'Admin account created.')
      setCreatedAdmin(data.admin)
      setForm({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        setupKey: '',
        role: ROLE_OWNER,
      })
      setTimeout(() => {
        navigate('/login', { replace: true })
      }, 900)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="admin-create-shell">
      <form className="admin-create-card" onSubmit={handleSubmit}>
        <div className="admin-create-header">
          <div>
            <h1>Create Admin Account</h1>
            <p>Set up a staff, operations, auditor, or top-level owner login.</p>
          </div>
          <Link className="btn-secondary admin-create-back" to="/dashboard">
            Back
          </Link>
        </div>

        <div className="admin-create-grid">
          <div className="form-field">
            <label htmlFor="new-admin-username">Username</label>
            <input
              id="new-admin-username"
              type="text"
              value={form.username}
              onChange={(e) => updateField('username', e.target.value)}
              autoComplete="off"
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="new-admin-email">Email</label>
            <input
              id="new-admin-email"
              type="email"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="form-field">
            <label htmlFor="new-admin-role">Account Role</label>
            <select
              id="new-admin-role"
              value={form.role}
              onChange={(e) => updateField('role', e.target.value)}
              required
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="new-admin-setup-key">Setup Key</label>
            <input
              id="new-admin-setup-key"
              type="password"
              value={form.setupKey}
              onChange={(e) => updateField('setupKey', e.target.value)}
              autoComplete="off"
              placeholder="Required after first admin exists"
            />
          </div>

          <div className="form-field">
            <label htmlFor="new-admin-password">Password</label>
            <input
              id="new-admin-password"
              type="password"
              value={form.password}
              onChange={(e) => updateField('password', e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="new-admin-confirm-password">Confirm Password</label>
            <input
              id="new-admin-confirm-password"
              type="password"
              value={form.confirmPassword}
              onChange={(e) => updateField('confirmPassword', e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
        </div>

        {error && <div className="auth-error">{error}</div>}
        {success && (
          <div className="success-banner">
            {success}
            {createdAdmin ? ` Username: ${createdAdmin.username}` : ''}
          </div>
        )}

        <div className="admin-create-footer">
          <button type="submit" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Account'}
          </button>
        </div>
      </form>
    </div>
  )
}
