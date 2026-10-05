// Thin fetch wrapper for the /adminpanel/ API, plus token storage.
// Every page talks to the backend through the `api` object below rather
// than calling fetch() directly, so auth headers and error handling stay
// in one place.
//
// --- Setup: pointing this app at your backend -------------------------------
// API_BASE_URL comes from the VITE_API_BASE_URL env var, read at build/dev
// time by Vite (import.meta.env.*). Set it in a `.env` or `.env.local` file
// in this project's root (see .env.example) — e.g.:
//     VITE_API_BASE_URL=http://localhost:8000
// or, for a deployed backend:
//     VITE_API_BASE_URL=https://api.your-production-domain.com
// If unset, it falls back to http://localhost:8000, which only works for
// local development against a Django server running on the default port.
// After changing a .env file you MUST restart `npm run dev` — Vite only
// reads env files at startup, not on every request.
//
// This is a completely separate app/build from securepay-client (the
// merchant frontend) — they each have their own VITE_API_BASE_URL and their
// own .env files, even though both usually point at the same backend.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
const TOKEN_KEY = 'securepay_admin_token'
const PARTNER_TOKEN_KEY = 'securepay_omniware_partner_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export function getPartnerToken() {
  return localStorage.getItem(PARTNER_TOKEN_KEY)
}

export function setPartnerToken(token) {
  if (token) localStorage.setItem(PARTNER_TOKEN_KEY, token)
  else localStorage.removeItem(PARTNER_TOKEN_KEY)
}

async function request(path, { method = 'GET', body, params, tokenType = 'admin' } = {}) {
  const url = new URL(`${API_BASE_URL}/adminpanel${path}`, window.location.origin)
  if (params) {
    // Drop empty/undefined params instead of sending them as literal "" —
    // keeps query strings clean and matches what the Django views expect.
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, value)
      }
    })
  }

  const token = tokenType === 'partner' ? getPartnerToken() : getToken()
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  // DELETE responses (204) and network hiccups have no JSON body — treat
  // a parse failure as "no data" rather than blowing up the caller.
  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }

  if (!res.ok) {
    const message = (data && data.error) || `Request failed with status ${res.status}`
    const error = new Error(message)
    error.status = res.status
    if (res.status === 401 || res.status === 403) {
      if (tokenType === 'partner') {
        setPartnerToken(null)
        window.dispatchEvent(new Event('securepay-partner-auth-expired'))
      } else {
        setToken(null)
        window.dispatchEvent(new Event('securepay-admin-auth-expired'))
      }
    }
    throw error
  }

  return data
}

async function trackingRequest(path) {
  const url = new URL(`${API_BASE_URL}/tracking${path}`, window.location.origin)
  const token = getToken()
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(url.toString(), { headers })
  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }

  if (!res.ok) {
    const providerDetails = data && (data.details || data.upstream_response)
    throw new Error(providerDetails || (data && data.error) || `Request failed with status ${res.status}`)
  }

  return data
}

// One method per backend endpoint — see adminpanel/urls.py for the routes.
async function uploadFile(path, file, { tokenType = 'admin' } = {}) {
  const url = new URL(`${API_BASE_URL}/adminpanel${path}`, window.location.origin)
  const token = tokenType === 'partner' ? getPartnerToken() : getToken()
  const body = new FormData()
  body.append('file', file)

  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers,
    body,
  })

  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }

  if (!res.ok) {
    const message = (data && data.error) || `Request failed with status ${res.status}`
    const error = new Error(message)
    error.status = res.status
    if (res.status === 401 || res.status === 403) {
      setToken(null)
      window.dispatchEvent(new Event('securepay-admin-auth-expired'))
    }
    throw error
  }

  return data
}

export const api = {
  trackParcel: (awb) => trackingRequest(`/track_shipment/${encodeURIComponent(awb)}/`),
  login: (username, password) => request('/login/', { method: 'POST', body: { username, password } }),
  logout: () => request('/logout/', { method: 'POST' }),
  me: () => request('/me/'),
  createAdminAccount: (body) => request('/accounts/create/', { method: 'POST', body }),
  adminUsers: () => request('/accounts/'),
  updateAdminUserRole: (userId, role) => request(`/accounts/${userId}/`, { method: 'PATCH', body: { role } }),
  updateAdminUserAccess: (userId, accessRules) =>
    request(`/accounts/${userId}/`, { method: 'PUT', body: { access_rules: accessRules } }),
  deleteAdminUser: (userId) => request(`/accounts/${userId}/`, { method: 'DELETE' }),
  stats: () => request('/stats/'),
  auditLogs: (params) => request('/audit-logs/', { params }),
  decisionHistory: (params) => request('/decision-history/', { params }),
  merchants: (params) => request('/merchants/', { params }),
  orders: (params) => request('/orders/', { params }),
  needsAttention: (params) => request('/needs-attention/', { params }),
  decideNeedsAttention: (vaultpayOrderId, decision) =>
    request(`/needs-attention/${vaultpayOrderId}/decision/`, { method: 'POST', body: { decision } }),
  decideNeedsAttentionPdf: (vaultpayOrderId, decision) =>
    request(`/needs-attention/${vaultpayOrderId}/pdf-decision/`, { method: 'POST', body: { decision } }),
  omniwareOversight: (params) => request('/aggregator-oversight/', { params }),
  paCapabilities: () => request('/pa-control/capabilities/'),
  paOrders: (params) => request('/pa-control/orders/', { params }),
  paCreateOrder: (body) => request('/pa-control/orders/', { method: 'POST', body }),
  paOrderAction: (vaultpayOrderId, action, body) =>
    request(`/pa-control/orders/${vaultpayOrderId}/${action}/`, { method: 'POST', body }),
  paEvidenceReport: async (token) => {
    const res = await fetch(`${API_BASE_URL}/adminpanel/pa-control/evidence/${token}/`)
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new Error(data?.error || `Request failed with status ${res.status}`)
    return data
  },
  omniwarePartnerLogin: (accessToken) =>
    request('/partner/aggregator/login/', { method: 'POST', body: { access_token: accessToken }, tokenType: 'partner' }),
  omniwarePartnerOversight: (params) =>
    request('/partner/aggregator/oversight/', { params, tokenType: 'partner' }),
  enquiries: (params) => request('/enquiries/', { params }),
  suspiciousPdfs: (params) => request('/suspicious-pdfs/', { params }),
  contactMessages: (params) => request('/contact-messages/', { params }),
  replyContactMessage: (messageId, body) => request(`/contact-messages/${messageId}/reply/`, { method: 'POST', body }),
  updateContactMessage: (messageId, body) => request(`/contact-messages/${messageId}/`, { method: 'PATCH', body }),
  enquiryNotes: (enquiryId) => request(`/enquiries/${enquiryId}/notes/`),
  addEnquiryNote: (enquiryId, note) =>
    request(`/enquiries/${enquiryId}/notes/`, { method: 'POST', body: { note } }),
  updateEnquiryNote: (enquiryId, noteId, note) =>
    request(`/enquiries/${enquiryId}/notes/${noteId}/`, { method: 'PATCH', body: { note } }),
  deleteEnquiryNote: (enquiryId, noteId) =>
    request(`/enquiries/${enquiryId}/notes/${noteId}/`, { method: 'DELETE' }),
  updateEnquiryResolution: (enquiryId, resolutionStatus, reason) =>
    request(`/enquiries/${enquiryId}/resolution/`, {
      method: 'PATCH',
      body: { resolution_status: resolutionStatus, reason },
    }),
  checkDelhiveryOtp: (awb) =>
    request('/courier-verification/delhivery/', { method: 'POST', body: { awb } }),
  saveDelhiveryVerificationDecision: (awb, decision, sourceCheckId) =>
    request('/courier-verification/delhivery/decision/', {
      method: 'POST',
      body: { awb, decision, source_check_id: sourceCheckId },
    }),
  checkBlueDartOtp: (awb) =>
    request('/courier-verification/bluedart/', { method: 'POST', body: { awb } }),
  checkDhlBlueDartOtp: (awb) =>
    request('/courier-verification/dhl-bluedart/', { method: 'POST', body: { awb } }),
  checkXpressbeesOtp: (awb) =>
    request('/courier-verification/xpressbees/', { method: 'POST', body: { awb } }),
  checkDtdcOtp: (awb) =>
    request('/courier-verification/dtdc/', { method: 'POST', body: { awb } }),
  checkShiprocketOtp: (awb) =>
    request('/courier-verification/shiprocket/', { method: 'POST', body: { awb } }),
  checkEkartOtp: (awb) =>
    request('/courier-verification/ekart/', { method: 'POST', body: { awb } }),
  checkShadowfaxOtp: (awb) =>
    request('/courier-verification/shadowfax/', { method: 'POST', body: { awb } }),
  checkBlueDartLabelOtpEvidence: (file) =>
    uploadFile('/courier-verification/bluedart/label-otp-evidence/', file),
  saveBlueDartVerificationDecision: (awb, decision, sourceCheckId) =>
    request('/courier-verification/bluedart/decision/', {
      method: 'POST',
      body: { awb, decision, source_check_id: sourceCheckId },
    }),
}
