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
import Icon from './Icon.jsx'

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
  // Mobile number check by SMS code, inside the form:
  // idle -> sent (code box shown) -> verified. 'skipped' = Firebase is not
  // set up yet, so the form sends without a code (see isSetupError).
  const [verify, setVerify] = useState({ status: 'idle' })
  const [now, setNow] = useState(() => Date.now())

  // Ticks the "Resend in 25s" countdown
  useEffect(() => {
    if (verify.status !== 'sent') return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [verify.status])

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
    // A different number needs its own check
    if (key === 'phone' && value !== form.phone && verify.status !== 'idle') setVerify({ status: 'idle' })
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
        const fieldErrors = mapServerErrors(err.fields)
        // The server didn't accept the number check (e.g. expired): verify again
        if (fieldErrors.phoneToken) {
          fieldErrors.phone = fieldErrors.phoneToken
          setVerify({ status: 'idle' })
        }
        setErrors(fieldErrors)
      } else {
        setErrors({ form: err.message })
      }
    }
  }

  // "Send OTP": texts a 6-digit code (Google's invisible reCAPTCHA checks
  // for bots). A number already verified in this tab is verified at once.
  async function sendOtp() {
    const msg = mobileError(form.phone)
    if (msg) return setErrors((er) => ({ ...er, phone: msg }))
    setErrors((er) => ({ ...er, phone: undefined }))
    setVerify((v) => ({ ...v, status: v.status === 'sent' ? 'sent' : 'sending', error: '' }))
    try {
      const token = await tokenIfVerified(form.phone)
      if (token) return setVerify({ status: 'verified' })
      const confirmation = await sendCode(form.phone, 'otp-recaptcha')
      const sentAt = Date.now()
      setNow(sentAt)
      setVerify({ status: 'sent', confirmation, code: '', error: '', resendAt: sentAt + RESEND_SECONDS * 1000 })
    } catch (err) {
      if (isSetupError(err)) return setVerify({ status: 'skipped' })
      setVerify({ status: 'idle' })
      setErrors((er) => ({ ...er, phone: otpErrorMessage(err) }))
    }
  }

  async function confirmOtp() {
    if (!/^\d{6}$/.test(verify.code)) return setVerify({ ...verify, error: 'Enter the 6-digit code from the SMS' })
    setVerify({ ...verify, checking: true, error: '' })
    try {
      await confirmCode(verify.confirmation, verify.code)
      setVerify({ status: 'verified' })
    } catch (err) {
      setVerify((v) => ({ ...v, checking: false, error: otpErrorMessage(err) }))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate(form)
    if (PHONE_OTP_ENABLED && !errs.phone && !['verified', 'skipped'].includes(verify.status)) {
      errs.phone = verify.status === 'sent' ? 'Enter the code we sent and tap Verify' : 'Tap "Send OTP" to verify your number'
    }
    setErrors(errs)
    if (Object.keys(errs).length) return

    setSubmitting(true)
    try {
      // A fresh proof (the one from Verify lasts an hour)
      const token = PHONE_OTP_ENABLED && verify.status === 'verified' ? await tokenIfVerified(form.phone) : undefined
      if (PHONE_OTP_ENABLED && verify.status === 'verified' && !token) {
        setVerify({ status: 'idle' })
        return setErrors({ phone: 'Please verify your number again' })
      }
      await send(token || undefined)
    } catch (err) {
      setErrors({ form: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  const resendIn = verify.status === 'sent' ? Math.max(0, Math.ceil((verify.resendAt - now) / 1000)) : 0
  const verified = verify.status === 'verified'

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

  // "+91" fixed in front, then exactly 10 digits, with the SMS code check
  const phoneField = (
    <div className={`field sg-verify ${errors.phone ? 'field--error' : ''}`}>
      <label htmlFor="enquiry-phone">
        Mobile number<em> *</em>
      </label>
      <div className="sg-verify__row">
        <span className={`sg-phone ${verified ? 'is-verified' : ''}`}>
          <span className="sg-phone__code" aria-hidden="true">
            +91
          </span>
          <input
            id="enquiry-phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="98765 43210"
            value={form.phone}
            onChange={set('phone')}
            onBlur={check('phone')}
            readOnly={verified}
            aria-invalid={!!errors.phone}
            aria-label="Mobile number, 10 digits"
          />
          {verified && (
            <span className="sg-verify__badge">
              <Icon name="check" size={14} /> Verified
            </span>
          )}
        </span>
        {PHONE_OTP_ENABLED && !verified && verify.status !== 'skipped' && verify.status !== 'sent' && (
          <button
            type="button"
            className="sg-btn sg-btn--ink sg-verify__btn"
            onClick={sendOtp}
            disabled={verify.status === 'sending'}
          >
            {verify.status === 'sending' ? 'Sending…' : 'Send OTP'}
          </button>
        )}
        {verified && (
          <button type="button" className="sg-textbtn sg-verify__change" onClick={() => setVerify({ status: 'idle' })}>
            Change
          </button>
        )}
      </div>
      {errors.phone && <small>{errors.phone}</small>}

      {verify.status === 'sent' && (
        <div className={`sg-otpbox ${verify.error ? 'has-error' : ''}`}>
          <p>
            Enter the 6-digit code sent to <strong>{formatMobile(form.phone)}</strong>
          </p>
          <div className="sg-verify__row">
            <input
              className="sg-otpbox__code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="••••••"
              maxLength={6}
              value={verify.code}
              onChange={(e) => setVerify({ ...verify, code: e.target.value.replace(/\D/g, '').slice(0, 6), error: '' })}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), confirmOtp())}
              autoFocus
              aria-label="6-digit SMS code"
              aria-invalid={!!verify.error}
            />
            <button type="button" className="sg-btn sg-btn--yellow sg-verify__btn" onClick={confirmOtp} disabled={verify.checking}>
              {verify.checking ? 'Checking…' : 'Verify'}
            </button>
          </div>
          {verify.error && <small>{verify.error}</small>}
          <div className="sg-otpbox__links">
            <button type="button" className="sg-textbtn" onClick={sendOtp} disabled={resendIn > 0}>
              {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
            </button>
            <button type="button" className="sg-textbtn" onClick={() => setVerify({ status: 'idle' })}>
              Change number
            </button>
          </div>
        </div>
      )}
    </div>
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

            {field('name', 'Your name', { autoComplete: 'name', autoFocus: true, maxLength: NAME_MAX }, true)}
            {phoneField}

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
              {submitting ? 'Sending…' : 'Send booking request'}
            </button>
            <p className="sg-modal__note">
              Free to send. We call you to confirm before anything is paid.
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
