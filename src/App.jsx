import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import DashboardLayout from './pages/DashboardLayout'
import OverviewPage from './pages/OverviewPage'
import OrdersPage from './pages/OrdersPage'
import NeedsAttentionPage from './pages/NeedsAttentionPage'
import EnquiriesPage from './pages/EnquiriesPage'
import DelhiveryOtpPage from './pages/DelhiveryOtpPage'
import DhlBlueDartOtpPage from './pages/DhlBlueDartOtpPage'
import XpressbeesOtpPage from './pages/XpressbeesOtpPage'
import DtdcOtpPage from './pages/DtdcOtpPage'
import ShiprocketOtpPage from './pages/ShiprocketOtpPage'
  import EkartOtpPage from './pages/EkartOtpPage'
import ShadowfaxOtpPage from './pages/ShadowfaxOtpPage'
import CourierOtpHubPage from './pages/CourierOtpHubPage'
import OmniwareOversightPage from './pages/OmniwareOversightPage'
import PAControlPlanePage from './pages/PAControlPlanePage'
import PAEvidenceReportPage from './pages/PAEvidenceReportPage'
import AuditTrailPage from './pages/AuditTrailPage'
import CreateAdminAccountPage from './pages/CreateAdminAccountPage'
import AllUsersPage from './pages/AllUsersPage'
import MerchantUsersPage from './pages/MerchantUsersPage'
import ContactMessagesPage from './pages/ContactMessagesPage'
import { OmniwarePartnerLoginPage, OmniwarePartnerPortal } from './pages/OmniwarePartnerPortal'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/aggregator/login" element={<OmniwarePartnerLoginPage />} />
        <Route path="/aggregator" element={<OmniwarePartnerPortal />} />
        <Route path="/pa-evidence/:token" element={<PAEvidenceReportPage />} />
        <Route path="/create-admin-account" element={<CreateAdminAccountPage />} />
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
          <Route path="needs-attention" element={<NeedsAttentionPage />} />
          <Route path="enquiries" element={<EnquiriesPage />} />
          <Route path="aggregator-oversight" element={<OmniwareOversightPage />} />
          <Route path="pa-control" element={<PAControlPlanePage />} />
          <Route path="delhivery-otp" element={<DelhiveryOtpPage />} />
          <Route path="dhl-bluedart-otp" element={<DhlBlueDartOtpPage />} />
          <Route path="xpressbees-otp" element={<XpressbeesOtpPage />} />
          <Route path="dtdc-otp" element={<DtdcOtpPage />} />
          <Route path="shiprocket-otp" element={<ShiprocketOtpPage />} />
            <Route path="ekart-otp" element={<EkartOtpPage />} />
          <Route path="shadowfax-otp" element={<ShadowfaxOtpPage />} />
          <Route path="courier-otp" element={<CourierOtpHubPage />} />
          <Route path="audit-trail" element={<AuditTrailPage />} />
          <Route path="all-users" element={<AllUsersPage />} />
          <Route path="merchant-users" element={<MerchantUsersPage />} />
          <Route path="messages" element={<ContactMessagesPage />} />
        </Route>
        {/* Any unknown path (including "/") just lands on the dashboard;
            ProtectedRoute will bounce to /login if there's no session. */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  )
}
