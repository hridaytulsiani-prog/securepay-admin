import { useState } from 'react'
import DelhiveryOtpPage from './DelhiveryOtpPage'
import DtdcOtpPage from './DtdcOtpPage'
import ShiprocketOtpPage from './ShiprocketOtpPage'
import EkartOtpPage from './EkartOtpPage'
import ShadowfaxOtpPage from './ShadowfaxOtpPage'

const COURIERS = [
  { key: 'delhivery', label: 'Delhivery', component: DelhiveryOtpPage },
  { key: 'dtdc', label: 'DTDC', component: DtdcOtpPage },
  { key: 'shiprocket', label: 'Shiprocket', component: ShiprocketOtpPage },
  { key: 'ekart', label: 'Ekart', component: EkartOtpPage },
  { key: 'shadowfax', label: 'Shadowfax', component: ShadowfaxOtpPage },
]

export default function CourierOtpHubPage() {
  const [activeCourier, setActiveCourier] = useState(COURIERS[0].key)
  const active = COURIERS.find((courier) => courier.key === activeCourier) || COURIERS[0]
  const ActivePage = active.component

  return (
    <div className="courier-otp-hub">
      <div className="courier-otp-hub-header">
        <div className="courier-otp-title-block">
          <div className="section-title courier-otp-section-title">
            <div className="section-title-left">
              <span className="orders-section-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M3.5 7.5h10v9h-10v-9Zm10 3h3.1l3.4 3.4v2.6h-6.5v-6Zm-7 5.5a2 2 0 1 0 4 0m5 0a2 2 0 1 0 4 0M5.5 5.5h6" />
                </svg>
              </span>
              Courier checks
            </div>
          </div>
          <p>Check public tracking evidence across all supported courier partners.</p>
        </div>
      </div>

      <nav className="courier-otp-tabs" aria-label="Courier OTP providers">
        {COURIERS.map((courier) => (
          <button
            key={courier.key}
            type="button"
            className={active.key === courier.key ? 'active' : ''}
            onClick={() => setActiveCourier(courier.key)}
          >
            {courier.label}
          </button>
        ))}
      </nav>

      <div className="courier-otp-panel">
        <ActivePage key={active.key} />
      </div>
    </div>
  )
}
