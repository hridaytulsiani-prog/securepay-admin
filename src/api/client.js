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
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const TOKEN_KEY = 'securepay_admin_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

async function request(path, { method = 'GET', body, params } = {}) {
  const url = new URL(`${API_BASE_URL}/adminpanel${path}`)
  if (params) {
    // Drop empty/undefined params instead of sending them as literal "" —
    // keeps query strings clean and matches what the Django views expect.
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, value)
      }
    })
  }

  const token = getToken()
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
    throw error
  }

  return data
}

// One method per backend endpoint — see adminpanel/urls.py for the routes.
export const api = {
  login: (username, password) => request('/login/', { method: 'POST', body: { username, password } }),
  logout: () => request('/logout/', { method: 'POST' }),
  me: () => request('/me/'),
  stats: () => request('/stats/'),
  orders: (params) => request('/orders/', { params }),
  enquiries: (params) => request('/enquiries/', { params }),
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
}
