import { useEffect, useState } from 'react'
import { createEnquiry } from '../api.js'
import { formatPrice, rentalDays, todayString, typeImage, typeLabel } from '../constants.js'

const EMPTY = {
  name: '',
  phone: '',
  email: '',
  pickupLocation: '',
  dropoffLocation: '',
  startDate: '',
  endDate: '',
  pickupTime: '10:00',
  dropoffTime: '10:00',
  message: '',
  website: '', // honeypot, always empty for humans
}

// Mirrors the backend rules, plus the workflow's 10-13 digit phone rule.
function validate(f) {
  const e = {}
  if (f.name.trim().length < 2) e.name = 'Please enter your name'
  const digits = f.phone.replace(/\D/g, '')
  if (!/^[0-9\s+\-()]+$/.test(f.phone.trim()) || digits.length < 10 || digits.length > 13) {
    e.phone = 'Enter a valid phone number (10 to 13 digits)'
  }
  if (f.email && !/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = 'Enter a valid email'
  if (f.pickupLocation.trim().length < 2) e.pickupLocation = 'Enter a pickup location'
  if (f.dropoffLocation.trim().length < 2) e.dropoffLocation = 'Enter a drop-off location'
  if (!f.startDate) e.startDate = 'Choose a pickup date'
  else if (f.startDate < todayString()) e.startDate = 'Pickup date cannot be in the past'
  if (!f.endDate) e.endDate = 'Choose a return date'
  else if (f.startDate && f.endDate < f.startDate) e.endDate = 'Return date must be on or after the pickup date'
  if (!f.pickupTime) e.pickupTime = 'Choose a pickup time'
  if (!f.dropoffTime) e.dropoffTime = 'Choose a return time'
  if (f.message.length > 1000) e.message = 'Message must be at most 1000 characters'
  return e
}

// Backend field names -> form field names (they match, except carId)
function mapServerErrors(fields) {
  const e = { ...fields }
  if (e.carId) {
    e.form = 'Sorry, this car is no longer available. Please choose another car.'
    delete e.carId
  }
  return e
}

// Pre-fill from the hero search, if the visitor used it
function initialForm(trip) {
  if (!trip) return EMPTY
  const pick = (k) => trip[k] || EMPTY[k]
  return {
    ...EMPTY,
    pickupLocation: pick('pickupLocation'),
    dropoffLocation: pick('dropoffLocation'),
    startDate: pick('startDate'),
    endDate: pick('endDate'),
    pickupTime: pick('pickupTime'),
    dropoffTime: pick('dropoffTime'),
  }
}

export default function EnquiryModal({ car, trip, onClose }) {
  const [form, setForm] = useState(() => initialForm(trip))
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setErrors((er) => ({ ...er, [key]: undefined, form: undefined }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate(form)
    setErrors(errs)
    if (Object.keys(errs).length) return

    setSubmitting(true)
    try {
      await createEnquiry({
        ...form,
        carId: car.id,
        email: form.email.trim(),
        message: form.message.trim() || undefined,
      })
      setDone(true)
    } catch (err) {
      if (err.status === 400 && Object.keys(err.fields).length) {
        setErrors(mapServerErrors(err.fields))
      } else {
        setErrors({ form: err.message })
      }
    } finally {
      setSubmitting(false)
    }
  }

  const days = rentalDays(form)

  const field = (key, label, props = {}, required = false) => (
    <label className={`field ${errors[key] ? 'field--error' : ''}`}>
      <span>
        {label}
        {required && <em> *</em>}
      </span>
      <input value={form[key]} onChange={set(key)} {...props} />
      {errors[key] && <small>{errors[key]}</small>}
    </label>
  )

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal sg-modal" role="dialog" aria-modal="true" aria-labelledby="enquiry-title">
        <button className="modal__close" onClick={onClose} aria-label="Close">
          ×
        </button>

        {done ? (
          <div className="modal__success">
            <div className="success-icon">✓</div>
            <h2>
              You're <em>on the list.</em>
            </h2>
            <p>We've received your enquiry for the {car.name}. We'll call you shortly to confirm the booking.</p>
            <button className="sg-btn sg-btn--ink" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <p className="sg-kicker">Booking request</p>
            <h2 id="enquiry-title">
              Book your <em>car</em>
            </h2>

            <div className="booking-car">
              <img src={car.images?.[0] || typeImage(car.type)} alt="" />
              <div>
                <strong>{car.name}</strong>
                <span>
                  {typeLabel(car.type)} · {formatPrice(car.pricePerDay, car.currency)}/day
                </span>
                {days > 0 && (
                  <span className="booking-car__total">
                    Estimated {formatPrice(car.pricePerDay * days, car.currency)} for {days}{' '}
                    {days === 1 ? 'day' : 'days'}
                  </span>
                )}
              </div>
            </div>

            <div className="grid-2">
              {field('name', 'Your name', { autoComplete: 'name', autoFocus: true }, true)}
              {field('phone', 'Phone', { type: 'tel', autoComplete: 'tel', placeholder: '+91 98765 43210' }, true)}
            </div>

            {field('email', 'Email (optional)', { type: 'email', autoComplete: 'email' })}

            <div className="grid-2">
              {field('startDate', 'Pickup date', { type: 'date', min: todayString() }, true)}
              {field('pickupTime', 'Pickup time', { type: 'time' }, true)}
              {field('endDate', 'Return date', { type: 'date', min: form.startDate || todayString() }, true)}
              {field('dropoffTime', 'Return time', { type: 'time' }, true)}
              {field('pickupLocation', 'Pickup location', { placeholder: 'e.g. Kochi' }, true)}
              {field('dropoffLocation', 'Drop-off location', { placeholder: 'e.g. Thrissur' }, true)}
            </div>

            <label className={`field ${errors.message ? 'field--error' : ''}`}>
              <span>Message</span>
              <textarea rows={3} value={form.message} onChange={set('message')} maxLength={1000} />
              {errors.message && <small>{errors.message}</small>}
            </label>

            {/* Honeypot: hidden from people, bots fill it in */}
            <input
              className="honeypot"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              value={form.website}
              onChange={set('website')}
            />

            {errors.form && <p className="alert alert--error">{errors.form}</p>}

            <button className="sg-btn sg-btn--yellow sg-btn--lg sg-btn--block" disabled={submitting}>
              {submitting ? 'Sending…' : 'Send booking request'}
            </button>
            <p className="sg-modal__note">Free to send. We call you to confirm before anything is paid.</p>
          </form>
        )}
      </div>
    </div>
  )
}
