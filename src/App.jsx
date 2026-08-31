import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import DashboardLayout from './pages/DashboardLayout'
import OverviewPage from './pages/OverviewPage'
import OrdersPage from './pages/OrdersPage'
import EnquiriesPage from './pages/EnquiriesPage'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        {/* Everything under /dashboard shares the sidebar/topnav shell and
            requires a logged-in admin (enforced by ProtectedRoute). */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<OverviewPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="enquiries" element={<EnquiriesPage />} />
        </Route>
        {/* Any unknown path (including "/") just lands on the dashboard;
            ProtectedRoute will bounce to /login if there's no session. */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  )
}
