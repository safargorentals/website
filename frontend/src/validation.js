import { todayString } from './constants.js'

// Input rules shared by the booking box and the booking form. The backend
// checks the same things again (backend/src/controllers/enquiries.js).

export const NAME_MAX = 60
export const EMAIL_MAX = 100
export const MESSAGE_MAX = 1000
// Bookings can be requested up to a year ahead
export const MAX_DAYS_AHEAD = 365

// Letters (any language), spaces and . ' -
const NAME_RE = /^[\p{L}][\p{L}\p{M} .'-]*$/u
// An Indian mobile number: 10 digits starting with 6, 7, 8 or 9
const MOBILE_RE = /^[6-9]\d{9}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i

// Keep only what a name can hold, so digits and symbols never get typed in
export function cleanName(value) {
  return value.replace(/[^\p{L}\p{M} .'-]/gu, '').replace(/\s{2,}/g, ' ').slice(0, NAME_MAX)
}

// Digits only, at most 10. A pasted "+91 98765 43210" or "098765 43210"
// loses its country code / leading 0 first.
export function cleanMobile(value) {
  let digits = value.replace(/\D/g, '')
  if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2)
  if (digits.length > 10 && digits.startsWith('0')) digits = digits.slice(1)
  return digits.slice(0, 10)
}

// '9876543210' -> '+91 98765 43210', the format sent to the backend
export function formatMobile(digits) {
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`
}

export function nameError(value) {
  const v = value.trim()
  if (!v) return 'Please enter your name'
  if (v.length < 2) return 'Name is too short'
  if (!NAME_RE.test(v)) return 'Use letters only'
  return ''
}

export function mobileError(digits) {
  if (!digits) return 'Please enter your mobile number'
  if (digits.length < 10) return 'Enter all 10 digits of your mobile number'
  if (!MOBILE_RE.test(digits)) return 'Enter a valid Indian mobile number (starts with 6, 7, 8 or 9)'
  return ''
}

export function emailError(value) {
  const v = value.trim()
  if (!v) return ''
  if (v.length > EMAIL_MAX || !EMAIL_RE.test(v)) return 'Enter a valid email, like name@example.com'
  return ''
}

// The last date a booking can start or end
export const maxDate = () => todayString(MAX_DAYS_AHEAD)

// Checks the trip dates and times. Returns { field: message } for whatever
// is wrong; the keys match the booking form's fields.
export function tripErrors(t) {
  const e = {}
  const now = new Date()
  const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  if (!t.startDate) e.startDate = 'Choose a pickup date'
  else if (t.startDate < todayString()) e.startDate = 'Pickup date cannot be in the past'
  else if (t.startDate > maxDate()) e.startDate = 'Bookings open up to a year ahead'

  if (!t.endDate) e.endDate = 'Choose a return date'
  else if (t.startDate && t.endDate < t.startDate) e.endDate = 'Return date must be on or after the pickup date'
  else if (t.endDate > maxDate()) e.endDate = 'Bookings open up to a year ahead'

  if (!t.pickupTime) e.pickupTime = 'Choose a pickup time'
  else if (t.startDate === todayString() && t.pickupTime <= nowTime) e.pickupTime = 'This time has already passed'

  if (!t.dropoffTime) e.dropoffTime = 'Choose a return time'
  else if (t.startDate && t.startDate === t.endDate && t.pickupTime && t.dropoffTime <= t.pickupTime) {
    e.dropoffTime = 'Return time must be after the pickup time'
  }
  return e
}
