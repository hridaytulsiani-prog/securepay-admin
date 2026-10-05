import { api } from '../api/client'
import CourierOtpPage from './CourierOtpPage'

export default function DtdcOtpPage() {
  return (
    <CourierOtpPage
      courierName="DTDC"
      pageTitle="SecurePay - DTDC OTP Check"
      awbLabel="DTDC AWB:"
      checkButtonLabel="Check DTDC tracking"
      checkOtp={api.checkDtdcOtp}
      emptyMessage="Enter a DTDC AWB to fetch public tracking evidence."
      publicEndpointNote="This check uses DTDC's public tracking-results endpoint. OTP status is marked Verified only when the response contains verification evidence; otherwise it is Not verified."
      showCarrierSummary={false}
      showAllCarrierFields={false}
      showHttpStatus={false}
      showOtpStatus={false}
      showCourierStatus={false}
      showStatusTime={false}
      showReturnedFieldsAsCards
    />
  )
}
