import { api } from '../api/client'
import CourierOtpPage from './CourierOtpPage'

export default function DelhiveryOtpPage() {
  return (
    <CourierOtpPage
      courierName="Delhivery"
      checkOtp={api.checkDelhiveryOtp}
      saveVerificationDecision={api.saveDelhiveryVerificationDecision}
      emptyMessage="Enter a Delhivery AWB to fetch carrier evidence."
    />
  )
}
