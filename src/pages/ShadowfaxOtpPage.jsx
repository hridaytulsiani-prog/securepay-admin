import { api } from '../api/client'
import CourierOtpPage from './CourierOtpPage'

export default function ShadowfaxOtpPage() {
  return (
    <CourierOtpPage
      courierName="Shadowfax"
      pageTitle="SecurePay - Shadowfax OTP Check"
      awbLabel="Shadowfax AWB:"
      checkButtonLabel="Check Shadowfax tracking"
      checkOtp={api.checkShadowfaxOtp}
      emptyMessage="Enter a Shadowfax AWB to fetch public tracking evidence."
      publicEndpointNote="This check uses the same public tracking request as Shadowfax's free tracking page. OTP status is marked Verified only when the response contains verification evidence; otherwise it is Not verified."
      showCarrierSummary={false}
      showAllCarrierFields={false}
      showHttpStatus={false}
      showOtpStatus={false}
      showTrackingDetails={false}
      showCourierStatus={false}
      statusTimeLabel="Delivery Date & Time"
    />
  )
}
