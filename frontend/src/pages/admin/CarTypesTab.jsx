import { useCallback, useEffect, useState } from 'react'
import {
  adminCreateCarType,
  adminDeleteCarType,
  adminListCarTypes,
  adminReorderCarTypes,
  adminUpdateCarType,
  adminUploadImages,
} from '../../api.js'
import { replaceCarTypes } from '../../carTypes.js'

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']

// Add / edit one type: name, short description and photo
function CarTypeForm({ type, onClose, onSaved, onUnauthorized }) {
  const [form, setForm] = useState({
    label: type?.label ?? '',
    blurb: type?.blurb ?? '',
    image: type?.image ?? '',
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setErrors((er) => ({ ...er, [key]: undefined, form: undefined }))
  }

  async function handleFile(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    if (!ALLOWED.includes(file.type) || file.size > MAX_BYTES) {
      setErrors((er) => ({ ...er, image: 'Only JPG, PNG or WebP up to 5 MB' }))
      return
    }
    setUploading(true)
    try {
      const res = await adminUploadImages([file])
      setForm((f) => ({ ...f, image: res.urls[0] }))
      setErrors((er) => ({ ...er, image: undefined }))
    } catch (err) {
      if (err.status === 401) return onUnauthorized()
      setErrors((er) => ({ ...er, image: err.message }))
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    const body = {
      label: form.label.trim(),
      blurb: form.blurb.trim(),
      image: form.image.trim() || null,
    }
    try {
      const saved = type ? await adminUpdateCarType(type.value, body) : await adminCreateCarType(body)
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
        <h2>{type ? `Edit ${type.label}` : 'Add a car type'}</h2>

        <label className={cls('label')}>
          <span>Name *</span>
          <input value={form.label} onChange={set('label')} placeholder="Mini Van" maxLength={30} autoFocus />
          {err('label')}
        </label>

        <label className={cls('blurb')}>
          <span>Short description</span>
          <input
            value={form.blurb}
            onChange={set('blurb')}
            placeholder="Seven seats, easy in city traffic"
            maxLength={80}
          />
          {err('blurb')}
        </label>

        <div className={cls('image')}>
          <span>Photo (shown in the car type list, and on cars that have no photo)</span>
          <div className="image-list">
            {form.image && (
              <div className="image-item">
                <img src={form.image} alt="" />
                <div className="image-item__actions">
                  <button type="button" onClick={() => setForm((f) => ({ ...f, image: '' }))}>
                    Remove
                  </button>
                </div>
              </div>
            )}
            <label className={`image-upload ${uploading ? 'is-busy' : ''}`}>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} disabled={uploading} />
              {uploading ? 'Uploading…' : form.image ? 'Replace' : '+ Upload'}
            </label>
          </div>
          {err('image')}
        </div>

        {type && (
          <p className="muted">
            Website filter name: <code>{type.value}</code> (stays the same when you rename the type, so existing cars
            keep it).
          </p>
        )}

        {errors.form && <p className="alert alert--error">{errors.form}</p>}

        <div className="modal__footer">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn--primary" disabled={saving || uploading}>
            {saving ? 'Saving…' : type ? 'Save changes' : 'Add type'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function CarTypesTab({ onUnauthorized }) {
  const [types, setTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // null = closed, {} = new, type = edit

  const handleError = useCallback(
    (err) => (err.status === 401 ? onUnauthorized() : setError(err.message)),
    [onUnauthorized],
  )

  // Keep the rest of the admin (car form, filters) in step with this list
  const update = useCallback((list) => {
    setTypes(list)
    replaceCarTypes(list)
  }, [])

  useEffect(() => {
    adminListCarTypes()
      .then((res) => update(res.data))
      .catch(handleError)
      .finally(() => setLoading(false))
  }, [update, handleError])

  async function move(index, delta) {
    const next = [...types]
    const [item] = next.splice(index, 1)
    next.splice(index + delta, 0, item)
    setBusy(true)
    setError('')
    try {
      const res = await adminReorderCarTypes(next.map((t) => t.value))
      update(res.data)
    } catch (err) {
      handleError(err)
    } finally {
      setBusy(false)
    }
  }

  async function remove(type) {
    if (!confirm(`Delete the "${type.label}" car type? It will disappear from the website.`)) return
    setError('')
    try {
      await adminDeleteCarType(type.value)
      update(types.filter((t) => t.value !== type.value))
    } catch (err) {
      handleError(err)
    }
  }

  function onSaved(saved) {
    update(
      types.some((t) => t.value === saved.value)
        ? types.map((t) => (t.value === saved.value ? saved : t))
        : [...types, saved],
    )
    setEditing(null)
  }

  return (
    <section>
      <div className="toolbar">
        <p className="muted">
          These are the categories shown on the website. Use the arrows to change their order.
        </p>
        <button className="btn btn--primary" onClick={() => setEditing({})}>
          + Add type
        </button>
      </div>

      {error && <p className="alert alert--error">{error}</p>}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th></th>
              <th>Type</th>
              <th>Description</th>
              <th>Cars</th>
              <th>Order</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="center">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && types.length === 0 && (
              <tr>
                <td colSpan={6} className="center muted">
                  No car types yet.
                </td>
              </tr>
            )}
            {!loading &&
              types.map((t, i) => (
                <tr key={t.value}>
                  <td>{t.image ? <img className="thumb" src={t.image} alt="" /> : <div className="thumb" />}</td>
                  <td>
                    <strong>{t.label}</strong>
                    <div className="muted">{t.value}</div>
                  </td>
                  <td className="muted">{t.blurb || '—'}</td>
                  <td>{t.carCount}</td>
                  <td className="actions">
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() => move(i, -1)}
                      disabled={busy || i === 0}
                      aria-label={`Move ${t.label} up`}
                    >
                      ↑
                    </button>
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() => move(i, 1)}
                      disabled={busy || i === types.length - 1}
                      aria-label={`Move ${t.label} down`}
                    >
                      ↓
                    </button>
                  </td>
                  <td className="actions">
                    <button className="btn btn--ghost btn--sm" onClick={() => setEditing(t)}>
                      Edit
                    </button>
                    <button
                      className="btn btn--danger btn--sm"
                      onClick={() => remove(t)}
                      disabled={t.carCount > 0}
                      title={t.carCount > 0 ? 'Move or delete the cars of this type first' : undefined}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <CarTypeForm
          type={editing.value ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
          onUnauthorized={onUnauthorized}
        />
      )}
    </section>
  )
}
