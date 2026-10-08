import { useCallback, useEffect, useState } from 'react'
import { adminDeleteEnquiry, adminListEnquiries, adminUpdateEnquiryStatus } from '../../api.js'
import useCarTypes from '../../carTypes.js'
import { ENQUIRY_STATUSES, rentalDays, telHref, whatsappHref } from '../../constants.js'

// Accept camelCase or snake_case rows, whichever the backend returns.
function normalize(e) {
  const pick = (camel, snake) => e[camel] ?? e[snake] ?? ''
  return {
    id: e.id,
    name: e.name,
    phone: e.phone || '',
    email: e.email || '',
    carName: pick('carName', 'car_name'),
    carType: pick('carType', 'car_type') || e.category || '',
    pickupLocation: pick('pickupLocation', 'pickup_location'),
    dropoffLocation: pick('dropoffLocation', 'dropoff_location'),
    startDate: String(pick('startDate', 'start_date')).slice(0, 10),
    endDate: String(pick('endDate', 'end_date')).slice(0, 10),
    pickupTime: String(pick('pickupTime', 'pickup_time')).slice(0, 5),
    dropoffTime: String(pick('dropoffTime', 'dropoff_time')).slice(0, 5),
    message: e.message || '',
    status: e.status || 'new',
    notes: e.notes || '',
    createdAt: pick('createdAt', 'created_at'),
  }
}

// '2026-10-10' -> 'Sat, 10 Oct 2026' (built from the parts, so the day
// never shifts with the browser's time zone)
function formatTripDate(value) {
  if (!value) return ''
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return value
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// '14:30' -> '2:30 PM'
function formatTime(value) {
  if (!value) return ''
  const [h, min] = value.split(':').map(Number)
  if (Number.isNaN(h)) return value
  return `${h % 12 || 12}:${String(min || 0).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

// When the enquiry arrived: '5 Oct 2026, 3:42 PM'
function formatReceived(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${date}, ${formatTime(`${d.getHours()}:${d.getMinutes()}`)}`
}

// Exact trip length: '2 days 8 hrs 30 min'
function tripLength(e) {
  if (!e.startDate || !e.endDate) return ''
  const start = new Date(`${e.startDate}T${e.pickupTime || '10:00'}`)
  const end = new Date(`${e.endDate}T${e.dropoffTime || '10:00'}`)
  const mins = Math.round((end - start) / 60000)
  if (!(mins > 0)) return ''
  const days = Math.floor(mins / 1440)
  const hours = Math.floor((mins % 1440) / 60)
  const rest = mins % 60
  return [
    days && `${days} ${days === 1 ? 'day' : 'days'}`,
    hours && `${hours} ${hours === 1 ? 'hr' : 'hrs'}`,
    rest && `${rest} min`,
  ]
    .filter(Boolean)
    .join(' ')
}

// '2 hours ago', '3 days ago'
function timeAgo(value) {
  const mins = Math.round((Date.now() - new Date(value).getTime()) / 60000)
  if (!Number.isFinite(mins)) return ''
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  const days = Math.round(hours / 24)
  return `${days} ${days === 1 ? 'day' : 'days'} ago`
}

export default function EnquiriesTab({ onUnauthorized }) {
  const carTypes = useCarTypes()
  const [enquiries, setEnquiries] = useState([])
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [unsupported, setUnsupported] = useState(false)

  const handleError = useCallback(
    (err) => {
      if (err.status === 401) return onUnauthorized()
      if (err.status === 404) return setUnsupported(true)
      setError(err.message)
    },
    [onUnauthorized],
  )

  // quiet: a background refresh, without the "Loading…" flash
  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true)
    setError('')
    try {
      const res = await adminListEnquiries({ status: statusFilter, limit: 100 })
      const rows = (Array.isArray(res) ? res : res.data || []).map(normalize)
      rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      setEnquiries(rows)
    } catch (err) {
      handleError(err)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, handleError])

  useEffect(() => {
    load()
  }, [load])

  // Keep the list fresh: changes made in the Google Sheet (status, notes)
  // and new enquiries show up without pressing Refresh. Every 10 seconds
  // while the tab is visible, and right away when coming back to it.
  useEffect(() => {
    const refresh = () => document.visibilityState === 'visible' && load({ quiet: true })
    const timer = setInterval(refresh, 10000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [load])

  async function changeStatus(id, status) {
    const prev = enquiries
    setEnquiries((es) => es.map((e) => (e.id === id ? { ...e, status } : e)))
    try {
      await adminUpdateEnquiryStatus(id, status)
    } catch (err) {
      setEnquiries(prev)
      handleError(err)
    }
  }

  async function remove(id) {
    if (!confirm('Delete this enquiry? This cannot be undone.')) return
    try {
      await adminDeleteEnquiry(id)
      setEnquiries((es) => es.filter((e) => e.id !== id))
    } catch (err) {
      handleError(err)
    }
  }

  if (unsupported) {
    return (
      <div className="alert alert--info">
        <strong>Enquiry management isn't available yet.</strong> The backend needs these routes:{' '}
        <code>GET /api/admin/enquiries</code>, <code>PATCH /api/admin/enquiries/:id</code> and{' '}
        <code>DELETE /api/admin/enquiries/:id</code>. New enquiries are still being saved to the database.
      </div>
    )
  }

  return (
    <section>
      <div className="toolbar">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {ENQUIRY_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <button className="btn btn--ghost" onClick={() => load()} disabled={loading}>
          Refresh
        </button>
      </div>

      {error && <p className="alert alert--error">{error}</p>}
      {loading && <p className="center muted">Loading…</p>}
      {!loading && !error && enquiries.length === 0 && <p className="center muted">No enquiries yet.</p>}

      <div className="enquiry-list">
        {!loading &&
          enquiries.map((e) => (
            <article key={e.id} className={`enquiry enquiry--${e.status}`}>
              <div className="enquiry__head">
                <div>
                  <h3>{e.name}</h3>
                  <p className="muted">
                    {e.carName || 'Car removed'}
                    {e.carType && ` · ${carTypes.label(e.carType)}`}
                  </p>
                </div>
                <select
                  className={`status status--${e.status}`}
                  value={e.status}
                  onChange={(ev) => changeStatus(e.id, ev.target.value)}
                >
                  {ENQUIRY_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <dl className="enquiry__details">
                <div>
                  <dt>Pickup</dt>
                  <dd>
                    <strong>{formatTripDate(e.startDate)}</strong> · {formatTime(e.pickupTime)}
                    {e.pickupLocation && <div className="muted">{e.pickupLocation}</div>}
                  </dd>
                </div>
                <div>
                  <dt>Return</dt>
                  <dd>
                    <strong>{formatTripDate(e.endDate)}</strong> · {formatTime(e.dropoffTime)}
                    {e.dropoffLocation && <div className="muted">{e.dropoffLocation}</div>}
                  </dd>
                </div>
                {rentalDays(e) > 0 && (
                  <div>
                    <dt>Rental length</dt>
                    <dd>
                      {tripLength(e) || 'Same day'}
                      {/* The site estimates prices per started day */}
                      <div className="muted">
                        Charged as {rentalDays(e)} {rentalDays(e) === 1 ? 'day' : 'days'}
                      </div>
                    </dd>
                  </div>
                )}
                <div>
                  <dt>Received</dt>
                  <dd>
                    {formatReceived(e.createdAt)} <span className="muted">({timeAgo(e.createdAt)})</span>
                  </dd>
                </div>
                {e.email && (
                  <div>
                    <dt>Email</dt>
                    <dd>
                      <a href={`mailto:${e.email}`}>{e.email}</a>
                    </dd>
                  </div>
                )}
                {e.message && (
                  <div className="enquiry__message">
                    <dt>Message</dt>
                    <dd>{e.message}</dd>
                  </div>
                )}
                {e.notes && (
                  <div className="enquiry__message">
                    <dt>Notes</dt>
                    <dd>{e.notes}</dd>
                  </div>
                )}
              </dl>

              <div className="enquiry__actions">
                <a className="btn btn--primary btn--sm" href={telHref(e.phone)}>
                  Call {e.phone}
                </a>
                <a
                  className="btn btn--whatsapp btn--sm"
                  href={whatsappHref(e.phone, `Hi ${e.name}, this is Drive Kochi about your ${e.carName || 'car'} enquiry.`)}
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp
                </a>
                <button className="btn btn--danger btn--sm" onClick={() => remove(e.id)}>
                  Delete
                </button>
              </div>
            </article>
          ))}
      </div>
    </section>
  )
}
