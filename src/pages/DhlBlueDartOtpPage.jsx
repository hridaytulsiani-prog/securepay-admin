import { api } from '../api/client'
import CourierOtpPage from './CourierOtpPage'

export default function DhlBlueDartOtpPage() {
  return (
    <CourierOtpPage
      courierName="DHL / Blue Dart"
      pageTitle="SecurePay - DHL / Blue Dart OTP Check"
      awbLabel="Blue Dart AWB:"
      checkButtonLabel="Check DHL tracking"
      checkOtp={api.checkDhlBlueDartOtp}
      saveVerificationDecision={api.saveBlueDartVerificationDecision}
      emptyMessage="Enter a Blue Dart AWB to fetch it through the DHL tracking API."
      publicEndpointNote="This test calls DHL's public tracking endpoint and displays the complete carrier response, including any OTP or code evidence returned for the AWB."
    />
  )
}
