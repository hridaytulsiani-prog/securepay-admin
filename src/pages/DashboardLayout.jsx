// Shared shell for every /dashboard/* page: top navbar + logout, with the
// active page rendered into <Outlet />.
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { hasPermission } from '../utils/roles'

export default function DashboardLayout() {
  const { admin, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand">SecurePay</div>
        </div>
        <nav className="topnav">
          {hasPermission(admin, 'dashboard.view') && (
            <NavLink to="/dashboard" end className={({ isActive }) => (isActive ? 'active' : '')}>
              Dashboard
            </NavLink>
          )}
          {hasPermission(admin, 'orders.view') && (
            <NavLink to="/dashboard/orders" className={({ isActive }) => (isActive ? 'active' : '')}>
              Orders
            </NavLink>
          )}
          {hasPermission(admin, 'needs_attention.view') && (
            <NavLink to="/dashboard/needs-attention" className={({ isActive }) => (isActive ? 'active' : '')}>
              Needs Attention
            </NavLink>
          )}
          {hasPermission(admin, 'enquiries.view') && (
            <NavLink to="/dashboard/enquiries" className={({ isActive }) => (isActive ? 'active' : '')}>
              Enquiries
            </NavLink>
          )}
          {/*
          {hasPermission(admin, 'aggregator.view') && (
            <NavLink to="/dashboard/aggregator-oversight" className={({ isActive }) => (isActive ? 'active' : '')}>
              Aggregator
            </NavLink>
          )}
          */}
          {hasPermission(admin, 'pa_control.manage') && (
            <NavLink to="/dashboard/pa-control" className={({ isActive }) => (isActive ? 'active' : '')}>
              PA Control
            </NavLink>
          )}
          {hasPermission(admin, 'courier.check') && (
            <NavLink to="/dashboard/courier-otp" className={({ isActive }) => (isActive ? 'active' : '')}>
              Courier
            </NavLink>
          )}
          {hasPermission(admin, 'audit.view') && (
            <NavLink to="/dashboard/audit-trail" className={({ isActive }) => (isActive ? 'active' : '')}>
              Audit Trail
            </NavLink>
          )}
          {hasPermission(admin, 'users.manage') && (
            <NavLink to="/dashboard/all-users" className={({ isActive }) => (isActive ? 'active' : '')}>
              Users
            </NavLink>
          )}
          {hasPermission(admin, 'users.manage') && (
            <NavLink to="/dashboard/merchant-users" className={({ isActive }) => (isActive ? 'active' : '')}>
              Merchants
            </NavLink>
          )}
          {hasPermission(admin, 'contact_messages.manage') && (
            <NavLink to="/dashboard/messages" className={({ isActive }) => (isActive ? 'active' : '')}>
              Messages
            </NavLink>
          )}
        </nav>
        <div className="topbar-actions">
          <div className="admin-profile">
            <span className="admin-avatar" aria-hidden="true">
              {(admin?.username || 'A').slice(0, 1).toUpperCase()}
            </span>
            <div className="admin-profile-copy">
              <strong>{admin?.username || 'Admin'}</strong>
              <span className="admin-role-tag">{admin?.role_label || admin?.role || 'Admin'}</span>
            </div>
          </div>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
