import { useEffect, useState } from 'react'
import { createEnquiry } from '../api.js'
import useCarTypes from '../carTypes.js'
import useLocations, { locationLabel } from '../locations.js'
import { formatPrice, rentalDays, todayString } from '../constants.js'
import {
  EMAIL_MAX,
  MESSAGE_MAX,
  NAME_MAX,
  cleanMobile,
  cleanName,
  emailError,
  formatMobile,
  maxDate,
  mobileError,
  nameError,
  tripErrors,
} from '../validation.js'
import { PHONE_OTP_ENABLED, confirmCode, isSetupError, otpErrorMessage, sendCode, tokenIfVerified } from '../phoneVerify.js'

const RESEND_SECONDS = 30

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

// Rules in validation.js; the backend checks them again
function validate(f) {
  const e = { ...tripErrors(f) }
  const add = (key, msg) => msg && (e[key] = msg)
  add('name', nameError(f.name))
  add('phone', mobileError(f.phone))
  add('email', emailError(f.email))
  if (!f.pickupLocation) e.pickupLocation = 'Choose a pickup location'
  if (!f.dropoffLocation) e.dropoffLocation = 'Choose a drop-off location'
  if (f.message.length > MESSAGE_MAX) e.message = `Message must be at most ${MESSAGE_MAX} characters`
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

// Pre-fill from the hero search, if the visitor used it; otherwise the same
// default dates as the search box (an empty date box on iPhone shows a grey
// date that looks filled in)
function initialForm(trip) {
  if (!trip) return { ...EMPTY, startDate: todayString(1), endDate: todayString(2) }
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
  const carTypes = useCarTypes()
  const locations = useLocations()
  const [form, setForm] = useState(() => initialForm(trip))
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  // The SMS code step: { confirmation, code, error, resendAt } once a code is sent
  const [otp, setOtp] = useState(null)
  const [now, setNow] = useState(() => Date.now())

  // Ticks the "Resend code in 25s" countdown
  useEffect(() => {
    if (!otp) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [otp])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  // Names and phone numbers are cleaned as they are typed, so letters can't
  // go into the phone box and the number can't get longer than 10 digits
  const CLEAN = { name: cleanName, phone: cleanMobile }

  const set = (key) => (e) => {
    const value = CLEAN[key] ? CLEAN[key](e.target.value) : e.target.value
    setForm((f) => {
      const next = { ...f, [key]: value }
      // Keep the return date on or after the pickup date
      if (key === 'startDate' && next.endDate && next.endDate < value) next.endDate = value
      return next
    })
    setErrors((er) => ({ ...er, [key]: undefined, form: undefined }))
  }

  // Show a field's problem as soon as the visitor leaves it
  const check = (key) => () => {
    const msg = validate(form)[key]
    if (msg && form[key]) setErrors((er) => ({ ...er, [key]: msg }))
  }

  // Saves the enquiry. phoneToken: proof from Firebase that the number was
  // verified by SMS (the backend checks it)
  async function send(phoneToken) {
    try {
      await createEnquiry({
        ...form,
        carId: car.id,
        name: form.name.trim(),
        phone: formatMobile(form.phone),
        email: form.email.trim(),
        message: form.message.trim() || undefined,
        phoneToken,
      })
      setDone(true)
    } catch (err) {
      if (err.status === 400 && Object.keys(err.fields).length) {
        // Back to the form, which shows the problems (a phone check problem
        // shows at the bottom)
        const fieldErrors = mapServerErrors(err.fields)
        if (fieldErrors.phoneToken) fieldErrors.form = fieldErrors.phoneToken
        setErrors(fieldErrors)
        setOtp(null)
      } else if (otp) {
        setOtp((o) => o && { ...o, error: err.message })
      } else {
        setErrors({ form: err.message })
      }
    }
  }

  // Texts a code to the number (Google's invisible reCAPTCHA checks for bots)
  async function requestCode() {
    const confirmation = await sendCode(form.phone, 'otp-recaptcha')
    const sentAt = Date.now()
    setNow(sentAt)
    setOtp({ confirmation, code: '', error: '', resendAt: sentAt + RESEND_SECONDS * 1000 })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate(form)
    setErrors(errs)
    if (Object.keys(errs).length) return

    setSubmitting(true)
    try {
      if (!PHONE_OTP_ENABLED) return await send(undefined)
      // Number already verified in this tab (a second enquiry): no new SMS
      const token = await tokenIfVerified(form.phone)
      if (token) return await send(token)
      await requestCode()
    } catch (err) {
      if (isSetupError(err)) return await send(undefined)
      setErrors({ form: err.code ? otpErrorMessage(err) : err.message })
    } finally {
      setSubmitting(false)
    }
  }

  async function verifyCode(e) {
    e.preventDefault()
    if (!/^\d{6}$/.test(otp.code)) return setOtp({ ...otp, error: 'Enter the 6-digit code from the SMS' })
    setSubmitting(true)
    try {
      const token = await confirmCode(otp.confirmation, otp.code)
      await send(token)
    } catch (err) {
      setOtp((o) => o && { ...o, error: otpErrorMessage(err) })
    } finally {
      setSubmitting(false)
    }
  }

  async function resend() {
    setSubmitting(true)
    try {
      await requestCode()
    } catch (err) {
      setOtp((o) => o && { ...o, error: otpErrorMessage(err) })
    } finally {
      setSubmitting(false)
    }
  }

  const resendIn = otp ? Math.max(0, Math.ceil((otp.resendAt - now) / 1000)) : 0

  const days = rentalDays(form)

  const field = (key, label, props = {}, required = false) => (
    <label className={`field ${errors[key] ? 'field--error' : ''}`}>
      <span>
        {label}
        {required && <em> *</em>}
      </span>
      <input
        value={form[key]}
        onChange={set(key)}
        onBlur={check(key)}
        aria-invalid={!!errors[key]}
        {...props}
      />
      {errors[key] && <small>{errors[key]}</small>}
    </label>
  )

  // "+91" fixed in front, then exactly 10 digits
  const phoneField = (
    <label className={`field ${errors.phone ? 'field--error' : ''}`}>
      <span>
        Mobile number<em> *</em>
      </span>
      <span className="sg-phone">
        <span className="sg-phone__code" aria-hidden="true">
          +91
        </span>
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="98765 43210"
          value={form.phone}
          onChange={set('phone')}
          onBlur={check('phone')}
          aria-invalid={!!errors.phone}
          aria-label="Mobile number, 10 digits"
        />
      </span>
      {errors.phone && <small>{errors.phone}</small>}
    </label>
  )

  // Dropdown of the admin-managed locations. A value from the search box that
  // is no longer in the list stays selectable, so nothing is silently lost.
  const locationField = (key, label) => (
    <label className={`field ${errors[key] ? 'field--error' : ''}`}>
      <span>
        {label}
        <em> *</em>
      </span>
      <select value={form[key]} onChange={set(key)} aria-invalid={!!errors[key]}>
        <option value="">Select location</option>
        {locations.map((l) => (
          <option key={l.id} value={l.name}>
            {locationLabel(l)}
          </option>
        ))}
        {form[key] && !locations.some((l) => l.name === form[key]) && <option value={form[key]}>{form[key]}</option>}
      </select>
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
        ) : otp ? (
          <form className="sg-otp" onSubmit={verifyCode} noValidate>
            <p className="sg-kicker">Step 2 of 2</p>
            <h2 id="enquiry-title">
              Verify your <em>number</em>
            </h2>
            <p className="sg-otp__lead">
              We sent a 6-digit code by SMS to <strong>{formatMobile(form.phone)}</strong>. Enter it to send your booking
              request.
            </p>
            <label className={`field ${otp.error ? 'field--error' : ''}`}>
              <span>SMS code</span>
              <input
                className="sg-otp__code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="••••••"
                maxLength={6}
                value={otp.code}
                onChange={(e) => setOtp({ ...otp, code: e.target.value.replace(/\D/g, '').slice(0, 6), error: '' })}
                autoFocus
                aria-invalid={!!otp.error}
              />
              {otp.error && <small>{otp.error}</small>}
            </label>
            <button className="sg-btn sg-btn--yellow sg-btn--lg sg-btn--block" disabled={submitting}>
              {submitting ? 'Checking…' : 'Verify and send request'}
            </button>
            <div className="sg-otp__links">
              <button type="button" className="sg-textbtn" onClick={resend} disabled={submitting || resendIn > 0}>
                {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
              </button>
              <button type="button" className="sg-textbtn" onClick={() => setOtp(null)} disabled={submitting}>
                Change number
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <p className="sg-kicker">Booking request</p>
            <h2 id="enquiry-title">
              Book your <em>car</em>
            </h2>

            <div className="booking-car">
              <img src={car.images?.[0] || carTypes.image(car.type)} alt="" />
              <div>
                <strong>{car.name}</strong>
                <span>
                  {carTypes.label(car.type)} · {formatPrice(car.pricePerDay, car.currency)}/day
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
              {field('name', 'Your name', { autoComplete: 'name', autoFocus: true, maxLength: NAME_MAX }, true)}
              {phoneField}
            </div>

            {field('email', 'Email (optional)', {
              type: 'email',
              autoComplete: 'email',
              inputMode: 'email',
              maxLength: EMAIL_MAX,
              placeholder: 'name@example.com',
            })}

            <div className="grid-2">
              {field('startDate', 'Pickup date', { type: 'date', min: todayString(), max: maxDate() }, true)}
              {field('pickupTime', 'Pickup time', { type: 'time' }, true)}
              {field('endDate', 'Return date', { type: 'date', min: form.startDate || todayString(), max: maxDate() }, true)}
              {field('dropoffTime', 'Return time', { type: 'time' }, true)}
              {locationField('pickupLocation', 'Pickup location')}
              {locationField('dropoffLocation', 'Drop-off location')}
            </div>

            <label className={`field ${errors.message ? 'field--error' : ''}`}>
              <span>Message (optional)</span>
              <textarea rows={3} value={form.message} onChange={set('message')} maxLength={MESSAGE_MAX} />
              <small className="sg-count">
                {form.message.length}/{MESSAGE_MAX}
              </small>
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
              {submitting ? 'Please wait…' : PHONE_OTP_ENABLED ? 'Continue' : 'Send booking request'}
            </button>
            <p className="sg-modal__note">
              {PHONE_OTP_ENABLED ? "Next, we'll text you a code to confirm your number. " : ''}Free to send. We call you to
              confirm before anything is paid.
            </p>
            <p className="sg-modal__legal">
              By sending this request you agree to our{' '}
              <a href="/terms" target="_blank" rel="noopener">
                Terms
              </a>{' '}
              and{' '}
              <a href="/privacy" target="_blank" rel="noopener">
                Privacy Policy
              </a>
              .
            </p>
          </form>
        )}
        {/* Google's invisible reCAPTCHA for the SMS code (no puzzle for most people) */}
        <div id="otp-recaptcha" />
      </div>
    </div>
  )
}
