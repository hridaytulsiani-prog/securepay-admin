import { api } from '../api/client'
import CourierOtpPage from './CourierOtpPage'

export default function ShiprocketOtpPage() {
  return (
    <CourierOtpPage
      courierName="Shiprocket"
      pageTitle="SecurePay - Shiprocket OTP Check"
      awbLabel="Shiprocket AWB:"
      checkButtonLabel="Check Shiprocket tracking"
      checkOtp={api.checkShiprocketOtp}
      emptyMessage="Enter a Shiprocket AWB to fetch tracking evidence."
      publicEndpointNote="This check uses Shiprocket's public AWB tracking page. OTP status is marked Verified only when the response contains verification evidence; otherwise it is Not verified."
      showCarrierSummary={false}
      showAllCarrierFields={false}
      showHttpStatus={false}
      showOtpStatus={false}
      showTrackingDetails={false}
      showCourierStatus={false}
    />
  )
}
