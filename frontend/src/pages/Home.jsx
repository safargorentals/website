import { useCallback, useEffect, useState } from 'react'
import { getCars, getFeaturedCars } from '../api.js'
import CarCard from '../components/CarCard.jsx'
import EnquiryModal from '../components/EnquiryModal.jsx'
import { CAR_TYPES, CONTACT_PHONE, WHATSAPP_NUMBER, telHref, whatsappHref } from '../constants.js'

const PAGE_SIZE = 12
const YEAR = new Date().getFullYear()

export default function Home() {
  const [type, setType] = useState('')
  const [cars, setCars] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [bookingCar, setBookingCar] = useState(null)
  const [featured, setFeatured] = useState([])

  const load = useCallback(async (selectedType, pageNum) => {
    setLoading(true)
    setError('')
    try {
      const res = await getCars({ type: selectedType, page: pageNum, limit: PAGE_SIZE })
      setCars((prev) => (pageNum === 1 ? res.data : [...prev, ...res.data]))
      setPage(res.page)
      setTotalPages(res.totalPages)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(type, 1)
  }, [type, load])

  // Featured cars are a nice-to-have; if the request fails the section just stays hidden.
  useEffect(() => {
    getFeaturedCars()
      .then((res) => setFeatured(res.data))
      .catch(() => {})
  }, [])

  const closeModal = useCallback(() => setBookingCar(null), [])

  return (
    <>
      <header className="site-header">
        <div className="container site-header__inner">
          <a href="/" className="logo">
            Safar<span>Go</span>
          </a>
          <a href={telHref(CONTACT_PHONE)} className="site-header__phone">
            📞 {CONTACT_PHONE}
          </a>
        </div>
      </header>

      <section className="hero">
        <div className="container">
          <h1>Rent the right car for every journey</h1>
          <p>SUVs, sedans, hatchbacks and more. Pick a car, send an enquiry and we'll call you back.</p>
          <div className="hero__actions">
            <a href="#cars" className="btn btn--primary btn--lg">
              Browse cars
            </a>
            <a href={telHref(CONTACT_PHONE)} className="btn btn--ghost btn--lg">
              Call {CONTACT_PHONE}
            </a>
          </div>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="container section">
          <h2 className="section__title">Featured cars</h2>
          <div className="car-grid">
            {featured.map((car) => (
              <CarCard key={car.id} car={car} onBook={setBookingCar} />
            ))}
          </div>
        </section>
      )}

      <main id="cars" className="container section">
        <h2 className="section__title">Our fleet</h2>

        <nav className="tabs" aria-label="Car types">
          {[{ value: '', label: 'All' }, ...CAR_TYPES].map((t) => (
            <button
              key={t.value || 'all'}
              className={`tab ${type === t.value ? 'tab--active' : ''}`}
              onClick={() => setType(t.value)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {error && (
          <div className="alert alert--error">
            {error}{' '}
            <button className="link" onClick={() => load(type, 1)}>
              Try again
            </button>
          </div>
        )}

        {!error && !loading && cars.length === 0 && (
          <p className="empty">No cars in this category yet. Please check back soon.</p>
        )}

        <div className="car-grid">
          {cars.map((car) => (
            <CarCard key={car.id} car={car} onBook={setBookingCar} />
          ))}
          {loading &&
            page === 1 &&
            Array.from({ length: 6 }, (_, i) => <div key={i} className="car-card car-card--skeleton" />)}
        </div>

        {page < totalPages && (
          <div className="center">
            <button className="btn btn--ghost" disabled={loading} onClick={() => load(type, page + 1)}>
              {loading ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </main>

      <footer className="site-footer">
        <div className="container">
          <p>
            © {YEAR} SafarGo Rentals · Call us at{' '}
            <a href={telHref(CONTACT_PHONE)}>{CONTACT_PHONE}</a>
          </p>
        </div>
      </footer>

      {WHATSAPP_NUMBER && (
        <a
          className="whatsapp-float"
          href={whatsappHref(WHATSAPP_NUMBER, 'Hi, I want to rent a car')}
          target="_blank"
          rel="noreferrer"
          aria-label="Chat on WhatsApp"
        >
          WhatsApp
        </a>
      )}

      {bookingCar && <EnquiryModal car={bookingCar} onClose={closeModal} />}
    </>
  )
}
