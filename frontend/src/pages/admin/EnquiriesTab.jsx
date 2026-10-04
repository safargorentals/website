import { useCallback, useEffect, useState } from 'react'
import { adminDeleteEnquiry, adminListEnquiries, adminUpdateEnquiryStatus } from '../../api.js'
import { ENQUIRY_STATUSES, telHref, typeLabel, whatsappHref } from '../../constants.js'

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
    createdAt: pick('createdAt', 'created_at'),
  }
}

function formatDateTime(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function EnquiriesTab({ onUnauthorized }) {
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

  const load = useCallback(async () => {
    setLoading(true)
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
        <button className="btn btn--ghost" onClick={load} disabled={loading}>
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
                    {e.carType && ` · ${typeLabel(e.carType)}`} · {formatDateTime(e.createdAt)}
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
                  <dt>Dates</dt>
                  <dd>
                    {e.startDate} {e.pickupTime} → {e.endDate} {e.dropoffTime}
                  </dd>
                </div>
                <div>
                  <dt>Route</dt>
                  <dd>
                    {e.pickupLocation} → {e.dropoffLocation}
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
