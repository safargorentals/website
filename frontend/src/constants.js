// Car types are managed in the admin panel (Car types tab) and loaded with
// useCarTypes() in carTypes.js. This is the starting list, used until the
// API answers. Each type has a photo used for the category list and as a
// sample photo for cars that have no images yet.
export const DEFAULT_CAR_TYPES = [
  { value: 'suv', label: 'SUV', image: '/images/suv.webp', blurb: 'Room for family and luggage' },
  { value: 'sedan', label: 'Sedan', image: '/images/sedan.webp', blurb: 'Comfort for city and highway' },
  { value: 'hatchback', label: 'Hatchback', image: '/images/hatchback.webp', blurb: 'Easy to park, light on fuel' },
  { value: 'van', label: 'Van', image: '/images/van.webp', blurb: 'For groups and long trips' },
  { value: 'luxury', label: 'Luxury', image: '/images/luxury.webp', blurb: 'For weddings and special days' },
  { value: 'pickup', label: 'Pickup', image: '/images/pickup.webp', blurb: 'Tough roads and cargo' },
]

export const TRANSMISSIONS = ['manual', 'automatic']
export const FUELS = ['petrol', 'diesel', 'hybrid', 'electric', 'cng']

// Backend statuses; "confirmed" is shown as "Booked" per the workflow.
export const ENQUIRY_STATUSES = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'confirmed', label: 'Booked' },
  { value: 'closed', label: 'Closed' },
]

export const CONTACT_PHONE = import.meta.env.VITE_CONTACT_PHONE || '+91 98765 43210'
export const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || ''

export function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : ''
}

// INR shows as "₹4,500" with Indian digit grouping (₹1,00,000).
export function formatPrice(amount, currency = 'INR') {
  const n = Number(amount)
  if (currency === 'INR') return `₹${n.toLocaleString('en-IN')}`
  return `${currency} ${n.toLocaleString('en-US')}`
}

export function telHref(phone) {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}

export function whatsappHref(phone, text = '') {
  const digits = phone.replace(/\D/g, '')
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}

export function todayString(offsetDays = 0) {
  const t = new Date()
  t.setDate(t.getDate() + offsetDays)
  const mm = String(t.getMonth() + 1).padStart(2, '0')
  const dd = String(t.getDate()).padStart(2, '0')
  return `${t.getFullYear()}-${mm}-${dd}`
}

// Rental days between two date+time pairs, rounded up, at least 1.
export function rentalDays(trip) {
  if (!trip?.startDate || !trip?.endDate) return 0
  const start = new Date(`${trip.startDate}T${trip.pickupTime || '10:00'}`)
  const end = new Date(`${trip.endDate}T${trip.dropoffTime || '10:00'}`)
  const ms = end - start
  if (!(ms > 0)) return trip.endDate === trip.startDate ? 1 : 0
  return Math.max(1, Math.ceil(ms / 86400000))
}

// '2026-10-10' -> '10 Oct'
export function shortDate(value) {
  if (!value) return ''
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
