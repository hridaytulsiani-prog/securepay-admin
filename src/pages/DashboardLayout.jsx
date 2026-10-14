// Shared shell for every /dashboard/* page: a collapsible left sidebar with the navigation, a slim top bar
// (sidebar toggle + account menu), and the active page rendered into <Outlet />.
// Desktop: the sidebar can be collapsed to an icon-only rail (remembered in localStorage).
// Phones / small tablets: the sidebar is a slide-in drawer opened with the top bar's menu button.
import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import GlobalSearch from '../components/GlobalSearch'
import { useAuth } from '../context/AuthContext'
import { hasPermission } from '../utils/roles'
import escrosafeLogo from '../assets/escrosafe-logo.png'

const COLLAPSE_KEY = 'securepay_admin_sidebar_collapsed'

// Small stroke icons, one per page (24x24 viewBox).
const ICONS = {
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  orders: <><path d="M6 3h12a1 1 0 0 1 1 1v16.5l-3-2-3 2-3-2-3 2V4a1 1 0 0 1 1-1Z" /><path d="M9 8h6M9 12h6" /></>,
  attention: <><path d="M12 3 2.5 20h19L12 3Z" /><path d="M12 10v4.5M12 17.5v.01" /></>,
  enquiries: <><path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1Z" /><path d="M9 10h6M9 13h4" /></>,
  pa: <><path d="M3 10 12 4l9 6" /><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" /></>,
  courier: <><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></>,
  audit: <><path d="M12 3 4 6v5.5c0 4.5 3.2 8 8 9.5 4.8-1.5 8-5 8-9.5V6l-8-3Z" /><path d="m9 12 2.2 2.2L15.5 10" /></>,
  users: <><circle cx="9" cy="8" r="3.2" /><path d="M3 20c.4-3.6 3-5.5 6-5.5s5.6 1.9 6 5.5" /><path d="M16 5.2a3 3 0 0 1 0 5.6M17.5 14.8c2 .6 3.2 2.3 3.5 5.2" /></>,
  merchants: <><path d="M4 9.5 5.5 4h13L20 9.5" /><path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0" /><path d="M5 12.5V20h14v-7.5M10 20v-4.5h4V20" /></>,
  messages: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 7 8.5 6 8.5-6" /></>,
  queries: <><circle cx="12" cy="12" r="9" /><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5M12 16.8v.01" /></>,
  issues: <><path d="M14.5 3.5a4 4 0 0 0-4.9 5L3.5 14.6a2 2 0 1 0 2.9 2.9l6.1-6.1a4 4 0 0 0 5-4.9l-2.6 2.6-2.2-.5-.5-2.2 2.3-2.9Z" /></>,
}

// Order and grouping of the sidebar. `permission` is the same permission the old top bar checked.
const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard', end: true, label: 'Dashboard', icon: 'dashboard', permission: 'dashboard.view' },
      { to: '/dashboard/orders', label: 'Orders', icon: 'orders', permission: 'orders.view' },
      { to: '/dashboard/needs-attention', label: 'Needs Attention', icon: 'attention', permission: 'needs_attention.view' },
      // Temporarily hidden from the admin UI; keep the route/page code available for later.
      // { to: '/dashboard/enquiries', label: 'Enquiries', icon: 'enquiries', permission: 'enquiries.view' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/dashboard/pa-control', label: 'PA Control', icon: 'pa', permission: 'pa_control.manage' },
      { to: '/dashboard/courier-otp', label: 'Courier', icon: 'courier', permission: 'courier.check' },
      { to: '/dashboard/audit-trail', label: 'Audit Trail', icon: 'audit', permission: 'audit.view' },
    ],
  },
  {
    label: 'People',
    items: [
      { to: '/dashboard/all-users', label: 'Users', icon: 'users', permission: 'users.manage' },
      { to: '/dashboard/merchant-users', label: 'Merchants', icon: 'merchants', permission: 'users.manage' },
    ],
  },
  {
    label: 'Support',
    items: [
      { to: '/dashboard/messages', label: 'Customer Enquiries', icon: 'messages', permission: 'contact_messages.manage' },
      { to: '/dashboard/merchant-queries', label: 'Merchant Enquiries', icon: 'queries', permission: 'contact_messages.manage' },
      { to: '/dashboard/merchant-issues', label: 'Merchant issues', icon: 'issues', permission: 'contact_messages.manage' },
      { to: '/dashboard/customer-issues', label: 'Customer issues', icon: 'issues', permission: 'contact_messages.manage' },
    ],
  },
]

function NavIcon({ name }) {
  return (
    <svg className="sidebar-icon" viewBox="0 0 24 24" aria-hidden="true">
      {ICONS[name]}
    </svg>
  )
}

function readCollapsed() {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

export default function DashboardLayout() {
  const { admin, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const moreMenuRef = useRef(null)
  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const displayName = admin?.username || 'Admin'
  const roleLabel = admin?.role_label || admin?.role || 'Admin'

  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => hasPermission(admin, item.permission)),
  })).filter((group) => group.items.length > 0)

  // Close the three-dot menu on an outside click or Escape.
  useEffect(() => {
    if (!isMoreOpen) {
      return undefined
    }
    const closeOnOutsideClick = (event) => {
      if (!moreMenuRef.current?.contains(event.target)) {
        setIsMoreOpen(false)
      }
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setIsMoreOpen(false)
      }
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isMoreOpen])

  // The phone drawer closes after choosing a page, and on Escape.
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])
  useEffect(() => {
    if (!drawerOpen) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setDrawerOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [drawerOpen])

  function toggleSidebar() {
    // On a phone the button opens/closes the drawer; on a laptop it collapses/expands the rail.
    if (window.matchMedia('(max-width: 900px)').matches) {
      setDrawerOpen((open) => !open)
      return
    }
    setCollapsed((current) => {
      const next = !current
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      } catch {
        // Remembering the choice is optional.
      }
      return next
    })
  }

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className={`app-shell has-sidebar${collapsed ? ' is-collapsed' : ''}${drawerOpen ? ' drawer-open' : ''}`}>
      <div className="sidebar-wrap">
      <aside className="sidebar" aria-label="Main navigation">
        <div className="sidebar-head">
          <div className="sidebar-brand brand-logo">
            <img className="sidebar-logo-full" src={escrosafeLogo} alt="EscroSafe" />
            <img className="sidebar-logo-short" src="/short-logo-new.png" alt="EscroSafe" />
          </div>
        </div>
        <nav className="sidebar-nav">
          {groups.map((group) => (
            <div className="sidebar-group" key={group.label}>
              <p className="sidebar-group-label">{group.label}</p>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  title={item.label}
                  className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                >
                  <NavIcon name={item.icon} />
                  <span className="sidebar-link-text">{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <button
        type="button"
        className="sidebar-edge-toggle"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-expanded={!collapsed}
        onClick={toggleSidebar}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m14.5 6-6 6 6 6" />
        </svg>
      </button>
      </div>
      {drawerOpen ? <div className="sidebar-backdrop" onClick={() => setDrawerOpen(false)} aria-hidden="true" /> : null}

      <div className="shell-main">
        <header className="topbar">
          {/* Phones only: opens the sidebar drawer (on a laptop the arrow on the sidebar's edge does this). */}
          <button
            type="button"
            className="sidebar-toggle"
            aria-label="Open navigation"
            aria-expanded={drawerOpen}
            onClick={toggleSidebar}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <GlobalSearch />
          <div className="topbar-actions">
            <div className="nav-more" ref={moreMenuRef}>
              <button
                type="button"
                className="nav-more-button"
                aria-label="More options"
                aria-haspopup="menu"
                aria-expanded={isMoreOpen}
                onClick={() => setIsMoreOpen((open) => !open)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="5" r="1.8" />
                  <circle cx="12" cy="12" r="1.8" />
                  <circle cx="12" cy="19" r="1.8" />
                </svg>
              </button>
              {isMoreOpen ? (
                <div className="nav-more-menu" role="menu">
                  <div className="nav-more-profile" role="presentation">
                    <span className="nav-user-avatar">{displayName.slice(0, 1).toUpperCase()}</span>
                    <div>
                      <strong>{displayName}</strong>
                      <span>{roleLabel}</span>
                    </div>
                  </div>
                  <button type="button" className="nav-more-logout" role="menuitem" onClick={handleLogout}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <path d="M16 17l5-5-5-5" />
                      <path d="M21 12H9" />
                    </svg>
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <main className="content">
          {/* the key reopens a page when its ?q= changes (a new top-bar search while already on that page) */}
          <Outlet key={`${location.pathname}${location.search}`} />
        </main>
      </div>
    </div>
  )
}
