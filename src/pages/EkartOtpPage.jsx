import { api } from '../api/client'
import CourierOtpPage from './CourierOtpPage'

export default function EkartOtpPage() {
  return (
    <CourierOtpPage
      courierName="Ekart"
      pageTitle="SecurePay - Ekart OTP Check"
      awbLabel="Ekart AWB:"
      checkButtonLabel="Check Ekart tracking"
      checkOtp={api.checkEkartOtp}
      emptyMessage="Enter an Ekart AWB to fetch public tracking evidence."
      publicEndpointNote="This check uses Ekart's free public tracking endpoint. OTP status is marked Verified only when the response contains verification evidence; otherwise it is Not verified."
      showCarrierSummary={false}
      showAllCarrierFields={false}
    />
  )
}
