import blueDartLogo from '../assets/couriers/blue-dart-real.png'
import delhiveryLogo from '../assets/couriers/delhivery-real.png'
import dtdcLogo from '../assets/couriers/dtdc-real.png'
import ecomExpressLogo from '../assets/couriers/ecom-express.png'
import ekartLogo from '../assets/couriers/ekart-real.png'
import shadowfaxLogo from '../assets/couriers/shadowfax.svg'
import shiprocketLogo from '../assets/couriers/shiprocket-real.png'
import xpressbeesLogo from '../assets/couriers/xpressbees-wordmark.svg'

const COURIERS = [
  { keys: ['blue dart', 'bluedart', 'blue_dart'], label: 'Blue Dart', logo: blueDartLogo },
  { keys: ['delhivery'], label: 'Delhivery', logo: delhiveryLogo },
  { keys: ['dtdc'], label: 'DTDC', logo: dtdcLogo },
  { keys: ['ecom express', 'ecomexpress', 'ecom_express'], label: 'Ecom Express', logo: ecomExpressLogo },
  { keys: ['ekart'], label: 'Ekart', logo: ekartLogo },
  { keys: ['shadowfax', 'shadow fax'], label: 'Shadowfax', logo: shadowfaxLogo },
  { keys: ['shiprocket'], label: 'Shiprocket', logo: shiprocketLogo },
  { keys: ['xpressbees', 'xpress bees', 'xpress_bees'], label: 'Xpressbees', logo: xpressbeesLogo },
]

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export default function CourierLabel({ courier }) {
  const normalized = normalize(courier)
  const match = COURIERS.find((item) => item.keys.some((key) => {
    const normalizedKey = normalize(key)
    return normalized === normalizedKey || normalized.includes(normalizedKey)
  }))

  if (!courier) return <span className="courier-logo-empty">Not assigned</span>
  if (!match) return <span className="courier-logo-fallback">{courier}</span>
  return (
    <span className={`courier-logo-cell courier-logo-${normalize(match.label).replaceAll(' ', '-')}`} title={courier}>
      <img src={match.logo} alt={`${match.label} courier label`} />
    </span>
  )
}
