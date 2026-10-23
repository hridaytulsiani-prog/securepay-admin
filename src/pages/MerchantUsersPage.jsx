import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import Modal from '../components/Modal'

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : 'Not recorded'
}

export default function MerchantUsersPage() {
  const [merchants, setMerchants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // /dashboard/<page>?q=... opens the page already searched (used by the top-bar search).
  const [searchParams] = useSearchParams()
  const [q, setQ] = useState(searchParams.get('q') || '')
  const [deleteMerchant, setDeleteMerchant] = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const [deleteSuccess, setDeleteSuccess] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    api
      .merchants({ q })
      .then((data) => {
        setMerchants(data.results || [])
        setError('')
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [q])

  useEffect(() => {
    load()
  }, [load])

  function handleSearch(e) {
    e.preventDefault()
    setQ(e.target.elements.search.value.trim())
  }

  async function handleDeleteMerchant() {
    if (!deleteMerchant) return

    setIsDeleting(true)
    setDeleteError('')
    setDeleteSuccess('')

    try {
      await api.deleteMerchant(deleteMerchant.id)
      setDeleteSuccess(`Deleted ${deleteMerchant.merchant_name}.`)
      setDeleteMerchant(null)
      load()
    } catch (err) {
      setDeleteError(err.message || 'Unable to delete merchant.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="merchant-users-page">
      <div className="panel-card merchant-users-surface">
        <div className="section-title merchant-users-section-title">
          <div className="section-title-left">
            <span className="orders-section-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M4 10.5V20h16v-9.5M3 10.5h18L19 4H5l-2 6.5ZM9 20v-5h6v5" />
              </svg>
            </span>
            Merchants
          </div>
        </div>

        <form className="toolbar merchant-users-toolbar" onSubmit={handleSearch}>
          <div className="toolbar-field">
            <label htmlFor="merchant-user-search">Search merchants:</label>
            <input
              id="merchant-user-search"
              name="search"
              placeholder="merchant name, email, username..."
              defaultValue={q}
            />
          </div>
          <button type="submit">Search</button>
          <button type="button" onClick={load}>
            Refresh
          </button>
        </form>

      {error && <div className="error-banner">{error}</div>}
      {deleteSuccess && <div className="success-banner">{deleteSuccess}</div>}

        <div className="table-wrap merchant-users-table-wrap">
          <table className="merchant-users-table">
            <thead>
              <tr>
                <th>Merchant Name</th>
                <th>Email</th>
                <th>Username</th>
                <th>Phone</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="empty-row">Loading merchants...</td>
                </tr>
              ) : merchants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-row">No merchants found.</td>
                </tr>
              ) : (
                merchants.map((merchant) => (
                  <tr key={merchant.id}>
                    <td>
                      <Link className="merchant-history-link" to={`/dashboard/merchants/${merchant.id}`}>{merchant.merchant_name}</Link>
                    </td>
                    <td>{merchant.merchant_email || '-'}</td>
                    <td>{merchant.username || '-'}</td>
                    <td>{merchant.merchant_phone || '-'}</td>
                    <td><span className="cell-muted">{formatDate(merchant.created_at)}</span></td>
                    <td>
                      <div className="merchant-user-actions">
                        <Link className="table-action-link" to={`/dashboard/merchants/${merchant.id}`}>History</Link>
                        <button
                          type="button"
                          className="danger-link-button"
                          onClick={() => {
                            setDeleteError('')
                            setDeleteMerchant(merchant)
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {deleteMerchant && (
        <Modal title={`Delete Merchant - ${deleteMerchant.merchant_name}`} onClose={() => setDeleteMerchant(null)} width={520}>
          <div className="merchant-delete-preview">
            <p>
              Delete this merchant account and all records linked to it, including orders, checkout sessions, notifications, and uploaded label records.
            </p>
            {deleteError && <div className="error-banner">{deleteError}</div>}
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setDeleteMerchant(null)} disabled={isDeleting}>
                Cancel
              </button>
              <button type="button" className="danger-link-button" onClick={() => void handleDeleteMerchant()} disabled={isDeleting}>
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function MerchantAccessModal({ merchant, onClose }) {
  return (
    <Modal title={`Edit Access - ${merchant.merchant_name}`} onClose={onClose} width={760}>
      <form className="access-form" onSubmit={(e) => e.preventDefault()}>
        <div className="access-list">
          <div className="access-row">
            <label className="access-toggle">
              <input type="checkbox" defaultChecked />
              <span>
                <strong>Merchant Dashboard</strong>
                <small>Allow access to the merchant dashboard.</small>
              </span>
            </label>
            <span className="status-pill status-pending">UI Only</span>
          </div>
          <div className="access-row">
            <label className="access-toggle">
              <input type="checkbox" defaultChecked />
              <span>
                <strong>Order Creation</strong>
                <small>Allow merchant to create payment orders.</small>
              </span>
            </label>
            <span className="status-pill status-pending">UI Only</span>
          </div>
          <div className="access-row">
            <label className="access-toggle">
              <input type="checkbox" defaultChecked />
              <span>
                <strong>PDF Upload</strong>
                <small>Allow shipment label PDF upload and validation.</small>
              </span>
            </label>
            <span className="status-pill status-pending">UI Only</span>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" disabled>
            Save Access
          </button>
        </div>
      </form>
    </Modal>
  )
}
