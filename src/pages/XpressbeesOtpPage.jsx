import { api } from '../api/client'
import CourierOtpPage from './CourierOtpPage'

export default function XpressbeesOtpPage() {
  return (
    <CourierOtpPage
      courierName="Xpressbees"
      pageTitle="SecurePay - Xpressbees OTP Check"
      awbLabel="Xpressbees AWB:"
      checkButtonLabel="Check Xpressbees tracking"
      checkOtp={api.checkXpressbeesOtp}
      emptyMessage="Enter an Xpressbees AWB to fetch public tracking evidence."
      publicEndpointNote="This check uses the Xpressbees public tracking endpoint and shows OTP, verification-code, delivery, and all returned carrier fields."
    />
  )
}
