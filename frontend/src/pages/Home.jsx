import { useCallback, useEffect, useState } from 'react'
import { getCars, getFeaturedCars } from '../api.js'
import CarCard from '../components/CarCard.jsx'
import EnquiryModal from '../components/EnquiryModal.jsx'
import Icon from '../components/Icon.jsx'
import SearchWidget from '../components/SearchWidget.jsx'
import {
  CAR_TYPES,
  CONTACT_PHONE,
  WHATSAPP_NUMBER,
  rentalDays,
  shortDate,
  telHref,
  typeLabel,
  whatsappHref,
} from '../constants.js'

const PAGE_SIZE = 12
const YEAR = new Date().getFullYear()

const NAV = [
  { href: '#fleet', label: 'Our fleet' },
  { href: '#why', label: 'Why SafarGo' },
  { href: '#how', label: 'How it works' },
  { href: '#faq', label: 'FAQs' },
]

const BENEFITS = [
  { icon: 'tag', title: 'Clear daily prices', text: 'The price you see per day is shown up front on every car.' },
  { icon: 'bolt', title: 'Book in minutes', text: 'Pick a car, choose your dates and send a request. No account needed.' },
  { icon: 'phone', title: 'Quick call-back', text: 'We call you to confirm the car, the price and the pickup details.' },
  { icon: 'route', title: 'Your pickup, your drop-off', text: 'Tell us where to hand over and collect the car, even in different places.' },
  { icon: 'shield', title: 'Well-kept cars', text: 'Every car is cleaned and checked before it goes out on a trip.' },
  { icon: 'headset', title: 'Real people to talk to', text: 'Questions before or during your trip? Call or WhatsApp us.' },
]

const STEPS = [
  { icon: 'search', title: 'Choose your car', text: 'Browse the fleet and pick the car that fits your trip.' },
  { icon: 'calendar', title: 'Pick dates and places', text: 'Tell us when and where you want to pick up and return it.' },
  { icon: 'phone', title: 'We confirm by phone', text: 'We call you back to confirm availability and the final price.' },
  { icon: 'car', title: 'Pick up and drive', text: 'Collect the car and enjoy the journey.' },
]

const FAQS = [
  {
    q: 'How do I book a car?',
    a: 'Choose a car, tap "Rent now" and fill in your dates, times and pickup and drop-off places. We will call you to confirm the booking.',
  },
  {
    q: 'Do I pay when I send the request?',
    a: 'No. Sending a booking request is free. We confirm the final price and how to pay when we call you.',
  },
  {
    q: 'What documents do I need?',
    a: 'Usually a valid driving licence and a photo ID. We will tell you exactly what to bring when we confirm your booking.',
  },
  {
    q: 'Can I return the car somewhere else?',
    a: 'Yes. Untick "Return to the same location" and enter a different drop-off place. We will confirm it when we call.',
  },
  {
    q: 'What does the price per day include?',
    a: 'Each car shows its daily rate. The total shown for your dates is an estimate; we confirm the final amount on the call.',
  },
]

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function Home() {
  const [type, setType] = useState('')
  const [cars, setCars] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [featured, setFeatured] = useState([])
  const [trip, setTrip] = useState(null)
  const [bookingCar, setBookingCar] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)

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

  function onSearch(t) {
    setTrip(t)
    setType(t.type)
    scrollToId('fleet')
  }

  function pickType(value) {
    setType(value)
    scrollToId('fleet')
  }

  const days = rentalDays(trip)

  return (
    <>
      <header className="site-header">
        <div className="container site-header__inner">
          <a href="/" className="logo">
            Safar<span>Go</span>
          </a>
          <nav className={`site-nav ${menuOpen ? 'site-nav--open' : ''}`} aria-label="Main">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} onClick={() => setMenuOpen(false)}>
                {n.label}
              </a>
            ))}
          </nav>
          <a href={telHref(CONTACT_PHONE)} className="btn btn--primary btn--sm site-header__call">
            <Icon name="phone" size={16} /> <span>{CONTACT_PHONE}</span>
          </a>
          <button
            className="site-header__menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <Icon name={menuOpen ? 'close' : 'menu'} size={24} />
          </button>
        </div>
      </header>

      <section className="hero">
        <div className="container hero__inner">
          <div className="hero__copy">
            <p className="eyebrow">Self-drive car rentals</p>
            <h1>
              Rent the right car for <em>every journey</em>
            </h1>
            <p className="hero__lead">
              SUVs, sedans, hatchbacks and more at clear daily prices. Choose your dates, send a request and we'll call
              you to confirm.
            </p>
            <ul className="hero__points">
              <li>
                <Icon name="check" size={16} /> No account needed
              </li>
              <li>
                <Icon name="check" size={16} /> Free booking request
              </li>
              <li>
                <Icon name="check" size={16} /> Pay after we confirm
              </li>
            </ul>
          </div>
          <SearchWidget onSearch={onSearch} />
        </div>
      </section>

      <section className="section container" aria-labelledby="types-title">
        <div className="section__head">
          <div>
            <p className="eyebrow">Browse by type</p>
            <h2 id="types-title">Find a car that fits your trip</h2>
          </div>
        </div>
        <div className="type-grid">
          {CAR_TYPES.map((t) => (
            <button key={t.value} className="type-card" onClick={() => pickType(t.value)}>
              <img src={t.image} alt="" loading="lazy" />
              <span className="type-card__text">
                <strong>{t.label}</strong>
                <small>{t.blurb}</small>
              </span>
            </button>
          ))}
        </div>
      </section>

      {featured.length > 0 && (
        <section className="section section--tint" aria-labelledby="featured-title">
          <div className="container">
            <div className="section__head">
              <div>
                <p className="eyebrow">Popular picks</p>
                <h2 id="featured-title">Cars we recommend</h2>
              </div>
              <a className="link-arrow" href="#fleet">
                Show all cars <Icon name="arrow" size={16} />
              </a>
            </div>
            <div className="car-grid">
              {featured.slice(0, 4).map((car) => (
                <CarCard key={car.id} car={car} days={days} onBook={setBookingCar} />
              ))}
            </div>
          </div>
        </section>
      )}

      <main id="fleet" className="section container">
        <div className="section__head">
          <div>
            <p className="eyebrow">Our fleet</p>
            <h2>{type ? `${typeLabel(type)} cars` : 'All cars'}</h2>
          </div>
        </div>

        {trip && (
          <div className="trip-bar">
            <span>
              <Icon name="calendar" size={16} />
              {shortDate(trip.startDate)} {trip.pickupTime} → {shortDate(trip.endDate)} {trip.dropoffTime}
              {days > 0 && (
                <strong>
                  {' '}
                  · {days} {days === 1 ? 'day' : 'days'}
                </strong>
              )}
            </span>
            {trip.pickupLocation && (
              <span>
                <Icon name="pin" size={16} />
                {trip.pickupLocation}
                {trip.dropoffLocation && trip.dropoffLocation !== trip.pickupLocation && ` → ${trip.dropoffLocation}`}
              </span>
            )}
            <button className="link" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              Change
            </button>
          </div>
        )}

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
          <div className="empty">
            <Icon name="car" size={40} />
            <p>No {type ? typeLabel(type).toLowerCase() + ' ' : ''}cars available right now.</p>
            <p>
              Call us on <a href={telHref(CONTACT_PHONE)}>{CONTACT_PHONE}</a> and we'll help you find one.
            </p>
          </div>
        )}

        <div className="car-grid">
          {cars.map((car) => (
            <CarCard key={car.id} car={car} days={days} onBook={setBookingCar} />
          ))}
          {loading &&
            page === 1 &&
            Array.from({ length: 4 }, (_, i) => <div key={i} className="car-card car-card--skeleton" />)}
        </div>

        {page < totalPages && (
          <div className="center">
            <button className="btn btn--ghost" disabled={loading} onClick={() => load(type, page + 1)}>
              {loading ? 'Loading…' : 'Show more cars'}
            </button>
          </div>
        )}
      </main>

      <section id="why" className="section section--tint" aria-labelledby="why-title">
        <div className="container">
          <div className="section__head section__head--center">
            <div>
              <p className="eyebrow">Why SafarGo</p>
              <h2 id="why-title">Renting a car made simple</h2>
            </div>
          </div>
          <div className="benefit-grid">
            {BENEFITS.map((b) => (
              <div key={b.title} className="benefit">
                <span className="benefit__icon">
                  <Icon name={b.icon} size={24} />
                </span>
                <h3>{b.title}</h3>
                <p>{b.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="section container" aria-labelledby="how-title">
        <div className="section__head section__head--center">
          <div>
            <p className="eyebrow">How it works</p>
            <h2 id="how-title">On the road in four steps</h2>
          </div>
        </div>
        <ol className="steps">
          {STEPS.map((s, i) => (
            <li key={s.title} className="step">
              <span className="step__num">{i + 1}</span>
              <span className="step__icon">
                <Icon name={s.icon} size={22} />
              </span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="cta">
        <div className="container cta__inner">
          <div>
            <h2>Not sure which car to pick?</h2>
            <p>Tell us about your trip and we'll suggest the right car and price.</p>
          </div>
          <div className="cta__actions">
            <a href={telHref(CONTACT_PHONE)} className="btn btn--primary btn--lg">
              <Icon name="phone" size={18} /> Call {CONTACT_PHONE}
            </a>
            {WHATSAPP_NUMBER && (
              <a
                href={whatsappHref(WHATSAPP_NUMBER, 'Hi, I want to rent a car')}
                className="btn btn--whatsapp btn--lg"
                target="_blank"
                rel="noreferrer"
              >
                <Icon name="chat" size={18} /> WhatsApp us
              </a>
            )}
          </div>
        </div>
      </section>

      <section id="faq" className="section container faq-wrap" aria-labelledby="faq-title">
        <div className="section__head section__head--center">
          <div>
            <p className="eyebrow">FAQs</p>
            <h2 id="faq-title">Questions people ask</h2>
          </div>
        </div>
        <div className="faq">
          {FAQS.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="site-footer">
        <div className="container site-footer__grid">
          <div>
            <a href="/" className="logo">
              Safar<span>Go</span>
            </a>
            <p>Self-drive car rentals for city trips, weekends away and long journeys.</p>
          </div>
          <div>
            <h3>Explore</h3>
            {NAV.map((n) => (
              <a key={n.href} href={n.href}>
                {n.label}
              </a>
            ))}
          </div>
          <div>
            <h3>Car types</h3>
            {CAR_TYPES.map((t) => (
              <button key={t.value} className="link" onClick={() => pickType(t.value)}>
                {t.label}
              </button>
            ))}
          </div>
          <div>
            <h3>Contact</h3>
            <a href={telHref(CONTACT_PHONE)}>
              <Icon name="phone" size={16} /> {CONTACT_PHONE}
            </a>
            {WHATSAPP_NUMBER && (
              <a href={whatsappHref(WHATSAPP_NUMBER)} target="_blank" rel="noreferrer">
                <Icon name="chat" size={16} /> WhatsApp
              </a>
            )}
          </div>
        </div>
        <div className="container site-footer__bottom">© {YEAR} SafarGo Rentals. All rights reserved.</div>
      </footer>

      {WHATSAPP_NUMBER && (
        <a
          className="whatsapp-float"
          href={whatsappHref(WHATSAPP_NUMBER, 'Hi, I want to rent a car')}
          target="_blank"
          rel="noreferrer"
          aria-label="Chat on WhatsApp"
        >
          <Icon name="chat" size={26} />
        </a>
      )}

      {bookingCar && <EnquiryModal car={bookingCar} trip={trip} onClose={closeModal} />}
    </>
  )
}
