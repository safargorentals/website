// Car types are a fixed list in the backend (see CAR_TYPES in adminCars.js).
export const CAR_TYPES = [
  { value: 'suv', label: 'SUV' },
  { value: 'sedan', label: 'Sedan' },
  { value: 'hatchback', label: 'Hatchback' },
  { value: 'van', label: 'Van' },
  { value: 'luxury', label: 'Luxury' },
  { value: 'pickup', label: 'Pickup' },
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

export const CONTACT_PHONE = import.meta.env.VITE_CONTACT_PHONE || '+92 300 0000000'
export const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || ''

export function typeLabel(value) {
  return CAR_TYPES.find((t) => t.value === value)?.label || value || 'Other'
}

export function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : ''
}

export function formatPrice(amount, currency = 'PKR') {
  return `${currency} ${Number(amount).toLocaleString('en-US')}`
}

export function telHref(phone) {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}

export function whatsappHref(phone, text = '') {
  const digits = phone.replace(/\D/g, '')
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}
