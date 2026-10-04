import { useState } from 'react'
import { CAR_TYPES, todayString } from '../constants.js'
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

  return (
    <form className="search" onSubmit={submit}>
      <div className="search__types" role="radiogroup" aria-label="Car type">
        {[{ value: '', label: 'Any car' }, ...CAR_TYPES].map((t) => (
          <button
            type="button"
            key={t.value || 'any'}
            role="radio"
            aria-checked={form.type === t.value}
            className={`chip ${form.type === t.value ? 'chip--active' : ''}`}
            onClick={() => setForm((f) => ({ ...f, type: t.value }))}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="search__grid">
        <label className="search__field search__field--wide">
          <span>
            <Icon name="pin" size={16} /> Pickup location
          </span>
          <input value={form.pickupLocation} onChange={set('pickupLocation')} placeholder="City or area" />
        </label>

        {!form.sameLocation && (
          <label className="search__field search__field--wide">
            <span>
              <Icon name="pin" size={16} /> Drop-off location
            </span>
            <input value={form.dropoffLocation} onChange={set('dropoffLocation')} placeholder="City or area" />
          </label>
        )}

        <label className="search__field">
          <span>
            <Icon name="calendar" size={16} /> Pickup date
          </span>
          <input type="date" value={form.startDate} min={todayString()} onChange={set('startDate')} required />
        </label>
        <label className="search__field">
          <span>
            <Icon name="clock" size={16} /> Time
          </span>
          <input type="time" value={form.pickupTime} onChange={set('pickupTime')} required />
        </label>
        <label className="search__field">
          <span>
            <Icon name="calendar" size={16} /> Return date
          </span>
          <input type="date" value={form.endDate} min={form.startDate} onChange={set('endDate')} required />
        </label>
        <label className="search__field">
          <span>
            <Icon name="clock" size={16} /> Time
          </span>
          <input type="time" value={form.dropoffTime} onChange={set('dropoffTime')} required />
        </label>
      </div>

      <div className="search__footer">
        <label className="checkbox">
          <input type="checkbox" checked={form.sameLocation} onChange={set('sameLocation')} />
          Return to the same location
        </label>
        {error && <span className="search__error">{error}</span>}
        <button className="btn btn--primary btn--lg">
          <Icon name="search" size={18} /> Find cars
        </button>
      </div>
    </form>
  )
}
