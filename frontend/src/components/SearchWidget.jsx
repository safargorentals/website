import { useState } from 'react'
import { CAR_TYPES, shortDate, todayString } from '../constants.js'
import Icon from './Icon.jsx'

// The hero booking box. It doesn't search the server by itself: it hands the
// trip to Home, which filters the fleet, shows trip totals on each car and
// pre-fills the enquiry form.
export default function SearchWidget({ initial, onSearch }) {
  const [form, setForm] = useState(
    () =>
      initial || {
        type: '',
        pickupLocation: '',
        dropoffLocation: '',
        sameLocation: true,
        startDate: todayString(1),
        pickupTime: '10:00',
        endDate: todayString(2),
        dropoffTime: '10:00',
      },
  )
  const [error, setError] = useState('')

  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => {
      const next = { ...f, [key]: value }
      // Keep the return date on or after the pickup date
      if (key === 'startDate' && next.endDate < value) next.endDate = value
      return next
    })
    setError('')
  }

  function submit(e) {
    e.preventDefault()
    if (form.startDate < todayString()) return setError('Pickup date cannot be in the past')
    if (form.endDate < form.startDate) return setError('Return date must be on or after the pickup date')
    onSearch({
      ...form,
      pickupLocation: form.pickupLocation.trim(),
      dropoffLocation: form.sameLocation ? form.pickupLocation.trim() : form.dropoffLocation.trim(),
    })
  }

  // Laid out as a boarding pass: trip details on the left, a perforated stub
  // with the search button on the right (below on phones).
  return (
    <form className="sg-pass" onSubmit={submit}>
      <div className="sg-pass__main">
        <div className="sg-pass__types" role="radiogroup" aria-label="Car type">
          {[{ value: '', label: 'Any car' }, ...CAR_TYPES].map((t) => (
            <button
              type="button"
              key={t.value || 'any'}
              role="radio"
              aria-checked={form.type === t.value}
              className={`sg-chip ${form.type === t.value ? 'is-active' : ''}`}
              onClick={() => setForm((f) => ({ ...f, type: t.value }))}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className={`sg-pass__grid ${form.sameLocation ? '' : 'has-dropoff'}`}>
          <label className="sg-pass__field sg-pass__field--from">
            <span>From</span>
            <input value={form.pickupLocation} onChange={set('pickupLocation')} placeholder="Pickup city or area" />
          </label>

          {!form.sameLocation && (
            <label className="sg-pass__field sg-pass__field--to">
              <span>To</span>
              <input value={form.dropoffLocation} onChange={set('dropoffLocation')} placeholder="Drop-off city or area" />
            </label>
          )}

          <div className="sg-pass__when">
            <label className="sg-pass__field">
              <span>Pickup</span>
              <input type="date" value={form.startDate} min={todayString()} onChange={set('startDate')} required />
            </label>
            <label className="sg-pass__field sg-pass__field--time">
              <span>Time</span>
              <input type="time" value={form.pickupTime} onChange={set('pickupTime')} required />
            </label>
          </div>
          <div className="sg-pass__when">
            <label className="sg-pass__field">
              <span>Return</span>
              <input type="date" value={form.endDate} min={form.startDate} onChange={set('endDate')} required />
            </label>
            <label className="sg-pass__field sg-pass__field--time">
              <span>Time</span>
              <input type="time" value={form.dropoffTime} onChange={set('dropoffTime')} required />
            </label>
          </div>
        </div>

        <label className="sg-check">
          <input type="checkbox" checked={form.sameLocation} onChange={set('sameLocation')} />
          Return to the same place
        </label>
      </div>

      <div className="sg-pass__stub">
        <span className="sg-pass__code" aria-hidden="true">
          DK · {shortDate(form.startDate)}
        </span>
        <button className="sg-btn sg-btn--yellow sg-btn--lg">
          <Icon name="search" size={18} /> Find cars
        </button>
        {error && (
          <span className="sg-pass__error" role="alert">
            {error}
          </span>
        )}
      </div>
    </form>
  )
}
