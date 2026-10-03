import { useState } from 'react'
import { adminCreateCar, adminUpdateCar, adminUploadImages } from '../../api.js'
import { CAR_TYPES, FUELS, TRANSMISSIONS, capitalize } from '../../constants.js'

const MAX_IMAGES = 10
const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']

function toForm(car) {
  return {
    name: car?.name ?? '',
    brand: car?.brand ?? '',
    type: car?.type ?? 'sedan',
    seats: car?.seats ?? 5,
    transmission: car?.transmission ?? 'automatic',
    fuel: car?.fuel ?? 'petrol',
    pricePerDay: car?.pricePerDay ?? '',
    currency: car?.currency ?? 'PKR',
    images: car?.images ?? [],
    description: car?.description ?? '',
    isAvailable: car?.isAvailable ?? true,
  }
}

export default function CarForm({ car, onClose, onSaved, onUnauthorized }) {
  const [form, setForm] = useState(() => toForm(car))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [imageUrl, setImageUrl] = useState('')

  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((er) => ({ ...er, [key]: undefined }))
  }

  async function handleFiles(e) {
    const files = [...e.target.files]
    e.target.value = ''
    if (!files.length) return

    const bad = files.find((f) => !ALLOWED.includes(f.type) || f.size > MAX_BYTES)
    if (bad) {
      setErrors((er) => ({ ...er, images: `${bad.name}: only JPG, PNG or WebP up to 5 MB` }))
      return
    }
    if (form.images.length + files.length > MAX_IMAGES) {
      setErrors((er) => ({ ...er, images: `A car can have at most ${MAX_IMAGES} images` }))
      return
    }

    setUploading(true)
    setErrors((er) => ({ ...er, images: undefined }))
    try {
      // The upload endpoint takes at most 5 files per request
      const urls = []
      for (let i = 0; i < files.length; i += 5) {
        const res = await adminUploadImages(files.slice(i, i + 5))
        urls.push(...res.urls)
      }
      setForm((f) => ({ ...f, images: [...f.images, ...urls] }))
    } catch (err) {
      if (err.status === 401) return onUnauthorized()
      setErrors((er) => ({ ...er, images: err.message }))
    } finally {
      setUploading(false)
    }
  }

  function addImageUrl() {
    const url = imageUrl.trim()
    if (!url.startsWith('https://')) {
      setErrors((er) => ({ ...er, images: 'Image URL must start with https://' }))
      return
    }
    if (form.images.length >= MAX_IMAGES) return
    setForm((f) => ({ ...f, images: [...f.images, url] }))
    setImageUrl('')
  }

  function removeImage(i) {
    setForm((f) => ({ ...f, images: f.images.filter((_, idx) => idx !== i) }))
  }

  function makeCover(i) {
    setForm((f) => ({ ...f, images: [f.images[i], ...f.images.filter((_, idx) => idx !== i)] }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    const body = {
      ...form,
      name: form.name.trim(),
      brand: form.brand.trim(),
      seats: Number(form.seats),
      pricePerDay: Number(form.pricePerDay),
      currency: form.currency.trim().toUpperCase(),
      description: form.description.trim(),
    }
    try {
      const saved = car ? await adminUpdateCar(car.id, body) : await adminCreateCar(body)
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
      <form className="modal modal--wide" onSubmit={handleSubmit} noValidate>
        <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2>{car ? `Edit ${car.name}` : 'Add a car'}</h2>

        <div className="grid-2">
          <label className={cls('name')}>
            <span>Name *</span>
            <input value={form.name} onChange={set('name')} placeholder="Toyota Fortuner" />
            {err('name')}
          </label>
          <label className={cls('brand')}>
            <span>Brand *</span>
            <input value={form.brand} onChange={set('brand')} placeholder="Toyota" />
            {err('brand')}
          </label>
          <label className={cls('type')}>
            <span>Type *</span>
            <select value={form.type} onChange={set('type')}>
              {CAR_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            {err('type')}
          </label>
          <label className={cls('seats')}>
            <span>Seats *</span>
            <input type="number" min={1} max={20} value={form.seats} onChange={set('seats')} />
            {err('seats')}
          </label>
          <label className={cls('transmission')}>
            <span>Transmission *</span>
            <select value={form.transmission} onChange={set('transmission')}>
              {TRANSMISSIONS.map((t) => (
                <option key={t} value={t}>
                  {capitalize(t)}
                </option>
              ))}
            </select>
            {err('transmission')}
          </label>
          <label className={cls('fuel')}>
            <span>Fuel *</span>
            <select value={form.fuel} onChange={set('fuel')}>
              {FUELS.map((f) => (
                <option key={f} value={f}>
                  {f === 'cng' ? 'CNG' : capitalize(f)}
                </option>
              ))}
            </select>
            {err('fuel')}
          </label>
          <label className={cls('pricePerDay')}>
            <span>Price per day *</span>
            <input type="number" min={0} max={1000000} value={form.pricePerDay} onChange={set('pricePerDay')} />
            {err('pricePerDay')}
          </label>
          <label className={cls('currency')}>
            <span>Currency</span>
            <input value={form.currency} onChange={set('currency')} maxLength={3} />
            {err('currency')}
          </label>
        </div>

        <label className={cls('description')}>
          <span>Description</span>
          <textarea rows={3} value={form.description} onChange={set('description')} maxLength={2000} />
          {err('description')}
        </label>

        <div className={cls('images')}>
          <span>Images ({form.images.length}/{MAX_IMAGES}). The first image is the cover.</span>
          <div className="image-list">
            {form.images.map((url, i) => (
              <div key={url + i} className="image-item">
                <img src={url} alt="" />
                <div className="image-item__actions">
                  {i > 0 && (
                    <button type="button" onClick={() => makeCover(i)}>
                      Cover
                    </button>
                  )}
                  <button type="button" onClick={() => removeImage(i)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
            <label className={`image-upload ${uploading ? 'is-busy' : ''}`}>
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleFiles} disabled={uploading || form.images.length >= MAX_IMAGES} />
              {uploading ? 'Uploading…' : '+ Upload'}
            </label>
          </div>
          <div className="inline-input">
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="…or paste a Cloudinary image URL"
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addImageUrl())}
            />
            <button type="button" className="btn btn--ghost btn--sm" onClick={addImageUrl}>
              Add URL
            </button>
          </div>
          {err('images')}
        </div>

        <label className="checkbox">
          <input type="checkbox" checked={form.isAvailable} onChange={set('isAvailable')} />
          Show this car on the website
        </label>

        {errors.form && <p className="alert alert--error">{errors.form}</p>}

        <div className="modal__footer">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn--primary" disabled={saving || uploading}>
            {saving ? 'Saving…' : car ? 'Save changes' : 'Add car'}
          </button>
        </div>
      </form>
    </div>
  )
}
