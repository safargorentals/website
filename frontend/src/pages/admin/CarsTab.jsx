import { useCallback, useEffect, useState } from 'react'
import { adminDeleteCar, adminListCars, adminSetFeatured } from '../../api.js'
import { CAR_TYPES, capitalize, formatPrice, typeLabel } from '../../constants.js'
import CarForm from './CarForm.jsx'

export default function CarsTab({ onUnauthorized }) {
  const [cars, setCars] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [typeFilter, setTypeFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // null = closed, {} = new, car = edit

  const handleError = useCallback(
    (err) => (err.status === 401 ? onUnauthorized() : setError(err.message)),
    [onUnauthorized],
  )

  const load = useCallback(
    async (p) => {
      setLoading(true)
      setError('')
      try {
        const res = await adminListCars({ page: p, limit: 100 })
        setCars(res.data)
        setPage(res.page)
        setTotalPages(res.totalPages)
      } catch (err) {
        handleError(err)
      } finally {
        setLoading(false)
      }
    },
    [handleError],
  )

  useEffect(() => {
    load(1)
  }, [load])

  async function remove(car) {
    if (!confirm(`Remove "${car.name}"? It will disappear from the website immediately.`)) return
    try {
      await adminDeleteCar(car.id)
      setCars((cs) => cs.filter((c) => c.id !== car.id))
    } catch (err) {
      handleError(err)
    }
  }

  async function toggleFeatured(car) {
    try {
      const updated = await adminSetFeatured(car.id, !car.isFeatured)
      setCars((cs) => cs.map((c) => (c.id === car.id ? updated : c)))
    } catch (err) {
      handleError(err)
    }
  }

  function onSaved(saved) {
    setCars((cs) => (cs.some((c) => c.id === saved.id) ? cs.map((c) => (c.id === saved.id ? saved : c)) : [saved, ...cs]))
    setEditing(null)
  }

  // The admin list endpoint has no type filter, so filter client-side.
  const visible = typeFilter ? cars.filter((c) => c.type === typeFilter) : cars

  return (
    <section>
      <div className="toolbar">
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          {CAR_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <button className="btn btn--primary" onClick={() => setEditing({})}>
          + Add car
        </button>
      </div>

      {error && <p className="alert alert--error">{error}</p>}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th></th>
              <th>Car</th>
              <th>Type</th>
              <th>Specs</th>
              <th>Price/day</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="center">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && visible.length === 0 && (
              <tr>
                <td colSpan={7} className="center muted">
                  No cars found.
                </td>
              </tr>
            )}
            {!loading &&
              visible.map((car) => (
                <tr key={car.id}>
                  <td>
                    {car.images?.[0] ? <img className="thumb" src={car.images[0]} alt="" /> : <div className="thumb" />}
                  </td>
                  <td>
                    <strong>{car.name}</strong>
                    <div className="muted">{car.brand}</div>
                  </td>
                  <td>
                    <span className="badge badge--type">{typeLabel(car.type)}</span>
                  </td>
                  <td className="muted">
                    {car.seats} seats · {capitalize(car.transmission)} · {capitalize(car.fuel)}
                  </td>
                  <td>{formatPrice(car.pricePerDay, car.currency)}</td>
                  <td>
                    <span className={`badge ${car.isAvailable ? 'badge--green' : 'badge--muted'}`}>
                      {car.isAvailable ? 'Available' : 'Hidden'}
                    </span>
                    {car.isFeatured && <span className="badge badge--amber">Featured</span>}
                  </td>
                  <td className="actions">
                    <button className="btn btn--ghost btn--sm" onClick={() => toggleFeatured(car)}>
                      {car.isFeatured ? 'Unfeature' : 'Feature'}
                    </button>
                    <button className="btn btn--ghost btn--sm" onClick={() => setEditing(car)}>
                      Edit
                    </button>
                    <button className="btn btn--danger btn--sm" onClick={() => remove(car)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pager">
          <button className="btn btn--ghost btn--sm" disabled={page <= 1} onClick={() => load(page - 1)}>
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button className="btn btn--ghost btn--sm" disabled={page >= totalPages} onClick={() => load(page + 1)}>
            Next
          </button>
        </div>
      )}

      {editing && (
        <CarForm car={editing.id ? editing : null} onClose={() => setEditing(null)} onSaved={onSaved} onUnauthorized={onUnauthorized} />
      )}
    </section>
  )
}
