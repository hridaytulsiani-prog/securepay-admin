import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import Modal from '../components/Modal'

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : 'Not recorded'
}

export default function MerchantUsersPage() {
  const [merchants, setMerchants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [editMerchant, setEditMerchant] = useState(null)
  const [deleteMerchant, setDeleteMerchant] = useState(null)

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

  return (
    <div>
      <h1>SecurePay - Merchant Users</h1>

      <div className="panel-card">
        <form className="toolbar" onSubmit={handleSearch}>
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
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="panel-card">
        <div className="section-title">
          <div className="section-title-left">
            Merchants <span className="count-badge">{merchants.length}</span>
          </div>
        </div>

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
                      <div className="cell-strong">{merchant.merchant_name}</div>
                      <div className="cell-muted">ID: {merchant.id}</div>
                    </td>
                    <td>{merchant.merchant_email || '-'}</td>
                    <td>{merchant.username || '-'}</td>
                    <td>{merchant.merchant_phone || '-'}</td>
                    <td><span className="cell-muted">{formatDate(merchant.created_at)}</span></td>
                    <td>
                      <div className="merchant-user-actions">
                        <button
                          type="button"
                          className="table-action-link"
                          onClick={() => setEditMerchant(merchant)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="danger-link-button"
                          onClick={() => setDeleteMerchant(merchant)}
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

      {editMerchant && (
        <MerchantAccessModal merchant={editMerchant} onClose={() => setEditMerchant(null)} />
      )}

      {deleteMerchant && (
        <Modal title={`Delete Merchant - ${deleteMerchant.merchant_name}`} onClose={() => setDeleteMerchant(null)} width={520}>
          <div className="merchant-delete-preview">
            <p>
              This control is prepared for deleting a merchant account, but deletion is not connected yet.
            </p>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setDeleteMerchant(null)}>
                Close
              </button>
              <button type="button" className="danger-link-button" onClick={() => setDeleteMerchant(null)}>
                Delete
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
