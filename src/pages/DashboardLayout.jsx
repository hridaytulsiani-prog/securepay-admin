// Shared shell for every /dashboard/* page: top navbar + logout, with the
// active page rendered into <Outlet />.
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

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
          <div className="brand-subtitle">Logistics Console</div>
        </div>
        <nav className="topnav">
          <NavLink to="/dashboard" end className={({ isActive }) => (isActive ? 'active' : '')}>
            Dashboard
          </NavLink>
          <NavLink to="/dashboard/orders" className={({ isActive }) => (isActive ? 'active' : '')}>
            Orders
          </NavLink>
          <NavLink to="/dashboard/enquiries" className={({ isActive }) => (isActive ? 'active' : '')}>
            Enquiries
          </NavLink>
        </nav>
        <div className="topbar-actions">
          <span className="admin-name">{admin?.username}</span>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
