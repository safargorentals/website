// Thin wrapper around fetch for the Drive Kochi API.
// The admin session is an httpOnly cookie, so every request sends credentials.
const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error || `Request failed (${status})`)
    this.status = status
    this.fields = body?.fields || {}
  }
}

async function request(path, { method = 'GET', body, form } = {}) {
  // X-Requested-With marks the request as coming from this site's own code;
  // the API refuses admin changes without it (cross-site request forgery
  // protection, see backend/src/middleware/adminRequestGuard.js).
  // cache: 'no-store' keeps API answers (especially admin data) out of the
  // browser cache.
  const opts = {
    method,
    credentials: 'include',
    cache: 'no-store',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
  }
  if (form) {
    opts.body = form
  } else if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  }

  let res
  try {
    res = await fetch(`${BASE}${path}`, opts)
  } catch {
    throw new ApiError(0, { error: 'Cannot reach the server. Check your connection.' })
  }

  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, data)
  return data
}

function qs(params) {
  const s = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') s.set(k, v)
  }
  const str = s.toString()
  return str ? `?${str}` : ''
}

// Public
export const getCars = (params = {}) => request(`/api/cars${qs(params)}`)
export const getFeaturedCars = () => request('/api/cars/featured')
export const getCar = (id) => request(`/api/cars/${id}`)
export const getCarTypes = () => request('/api/car-types')
export const getLocations = () => request('/api/locations')
export const createEnquiry = (body) => request('/api/enquiries', { method: 'POST', body })

// Admin auth
export const adminLogin = (email, password) =>
  request('/api/admin/login', { method: 'POST', body: { email, password } })
export const adminLogout = () => request('/api/admin/logout', { method: 'POST' })
export const adminMe = () => request('/api/admin/me')

// Admin cars
export const adminListCars = (params = {}) => request(`/api/admin/cars${qs(params)}`)
export const adminCreateCar = (body) => request('/api/admin/cars', { method: 'POST', body })
export const adminUpdateCar = (id, body) =>
  request(`/api/admin/cars/${id}`, { method: 'PUT', body })
export const adminSetFeatured = (id, isFeatured, featuredOrder) =>
  request(`/api/admin/cars/${id}/featured`, {
    method: 'PATCH',
    body: featuredOrder ? { isFeatured, featuredOrder } : { isFeatured },
  })
export const adminDeleteCar = (id) => request(`/api/admin/cars/${id}`, { method: 'DELETE' })

// Admin car types
export const adminListCarTypes = () => request('/api/admin/car-types')
export const adminCreateCarType = (body) => request('/api/admin/car-types', { method: 'POST', body })
export const adminUpdateCarType = (value, body) =>
  request(`/api/admin/car-types/${encodeURIComponent(value)}`, { method: 'PUT', body })
export const adminReorderCarTypes = (slugs) =>
  request('/api/admin/car-types/order', { method: 'PUT', body: { slugs } })
export const adminDeleteCarType = (value) =>
  request(`/api/admin/car-types/${encodeURIComponent(value)}`, { method: 'DELETE' })

// Admin locations
export const adminListLocations = () => request('/api/admin/locations')
export const adminCreateLocation = (body) => request('/api/admin/locations', { method: 'POST', body })
export const adminUpdateLocation = (id, body) => request(`/api/admin/locations/${id}`, { method: 'PUT', body })
export const adminReorderLocations = (ids) =>
  request('/api/admin/locations/order', { method: 'PUT', body: { ids } })
export const adminDeleteLocation = (id) => request(`/api/admin/locations/${id}`, { method: 'DELETE' })

export function adminUploadImages(files) {
  const form = new FormData()
  for (const f of files) form.append('images', f)
  return request('/api/admin/uploads', { method: 'POST', form })
}

// Admin enquiries (routes from the workflow spec; not in the backend yet)
export const adminListEnquiries = (params = {}) =>
  request(`/api/admin/enquiries${qs(params)}`)
export const adminUpdateEnquiryStatus = (id, status) =>
  request(`/api/admin/enquiries/${id}`, { method: 'PATCH', body: { status } })
export const adminDeleteEnquiry = (id) =>
  request(`/api/admin/enquiries/${id}`, { method: 'DELETE' })
