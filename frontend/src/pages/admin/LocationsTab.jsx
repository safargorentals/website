import { useCallback, useEffect, useState } from 'react'
import {
  adminCreateLocation,
  adminDeleteLocation,
  adminListLocations,
  adminReorderLocations,
  adminUpdateLocation,
} from '../../api.js'
import { locationLabel, replaceLocations } from '../../locations.js'

// Add / edit one location: its name and an optional short label
function LocationForm({ location, onClose, onSaved, onUnauthorized }) {
  const [form, setForm] = useState({ name: location?.name ?? '', tag: location?.tag ?? '' })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setErrors((er) => ({ ...er, [key]: undefined, form: undefined }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    const body = { name: form.name.trim(), tag: form.tag.trim() }
    try {
      const saved = location ? await adminUpdateLocation(location.id, body) : await adminCreateLocation(body)
      onSaved(saved)
    } catch (err) {
      if (err.status === 401) return onUnauthorized()
      setErrors({ ...err.fields, form: err.message })
    } finally {
      setSaving(false)
    }
  }

  const err = (key) => errors[key] && <small>{errors[key]}</small>
  const cls = (key) => `field ${errors[key] ? 'field--error' : ''}`

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={handleSubmit} noValidate>
        <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2>{location ? `Edit ${location.name}` : 'Add a location'}</h2>

        <label className={cls('name')}>
          <span>Name *</span>
          <input value={form.name} onChange={set('name')} placeholder="Kochi Airport" maxLength={60} autoFocus />
          {err('name')}
        </label>

        <label className={cls('tag')}>
          <span>Label (optional, shown in brackets)</span>
          <input value={form.tag} onChange={set('tag')} placeholder="pickup, yard, branch…" maxLength={20} />
          {err('tag')}
        </label>

        <p className="muted">
          Shown as: <strong>{locationLabel({ name: form.name.trim() || 'Name', tag: form.tag.trim() })}</strong>
        </p>

        {errors.form && <p className="alert alert--error">{errors.form}</p>}

        <div className="modal__footer">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn--primary" disabled={saving}>
            {saving ? 'Saving…' : location ? 'Save changes' : 'Add location'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function LocationsTab({ onUnauthorized }) {
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // null = closed, {} = new, location = edit

  const handleError = useCallback(
    (err) => (err.status === 401 ? onUnauthorized() : setError(err.message)),
    [onUnauthorized],
  )

  // Keep the website preview (and booking forms) in step with this list
  const update = useCallback((list) => {
    setLocations(list)
    replaceLocations(list)
  }, [])

  useEffect(() => {
    adminListLocations()
      .then((res) => update(res.data))
      .catch(handleError)
      .finally(() => setLoading(false))
  }, [update, handleError])

  async function move(index, delta) {
    const next = [...locations]
    const [item] = next.splice(index, 1)
    next.splice(index + delta, 0, item)
    setBusy(true)
    setError('')
    try {
      const res = await adminReorderLocations(next.map((l) => l.id))
      update(res.data)
    } catch (err) {
      handleError(err)
    } finally {
      setBusy(false)
    }
  }

  async function remove(location) {
    if (!confirm(`Delete "${location.name}"? Customers will no longer be able to choose it. Past enquiries keep it.`))
      return
    setError('')
    try {
      await adminDeleteLocation(location.id)
      update(locations.filter((l) => l.id !== location.id))
    } catch (err) {
      handleError(err)
    }
  }

  function onSaved(saved) {
    update(
      locations.some((l) => l.id === saved.id)
        ? locations.map((l) => (l.id === saved.id ? saved : l))
        : [...locations, saved],
    )
    setEditing(null)
  }

  return (
    <section>
      <div className="toolbar">
        <p className="muted">
          Pickup and drop-off places customers can choose. They also scroll across the yellow band on the website.
        </p>
        <button className="btn btn--primary" onClick={() => setEditing({})}>
          + Add location
        </button>
      </div>

      {error && <p className="alert alert--error">{error}</p>}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Location</th>
              <th>Shown to customers as</th>
              <th>Order</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="center">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && locations.length === 0 && (
              <tr>
                <td colSpan={4} className="center muted">
                  No locations yet. Customers will not be able to pick a place until you add one.
                </td>
              </tr>
            )}
            {!loading &&
              locations.map((l, i) => (
                <tr key={l.id}>
                  <td>
                    <strong>{l.name}</strong>
                    {l.tag && <div className="muted">{l.tag}</div>}
                  </td>
                  <td className="muted">{locationLabel(l)}</td>
                  <td className="actions">
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() => move(i, -1)}
                      disabled={busy || i === 0}
                      aria-label={`Move ${l.name} up`}
                    >
                      ↑
                    </button>
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() => move(i, 1)}
                      disabled={busy || i === locations.length - 1}
                      aria-label={`Move ${l.name} down`}
                    >
                      ↓
                    </button>
                  </td>
                  <td className="actions">
                    <button className="btn btn--ghost btn--sm" onClick={() => setEditing(l)}>
                      Edit
                    </button>
                    <button className="btn btn--danger btn--sm" onClick={() => remove(l)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <LocationForm
          location={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
          onUnauthorized={onUnauthorized}
        />
      )}
    </section>
  )
}
