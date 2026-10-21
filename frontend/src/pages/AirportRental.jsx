import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCars } from '../api.js'
import CarCard from '../components/CarCard.jsx'
import EnquiryModal from '../components/EnquiryModal.jsx'
import FaqList from '../components/FaqList.jsx'
import Icon from '../components/Icon.jsx'
import SearchWidget from '../components/SearchWidget.jsx'
import { SiteFooter, SiteHeader, WhatsAppFloat } from '../components/SiteChrome.jsx'
import { withTodos } from '../components/Todo.jsx'
import useReveal from '../useReveal.js'
import useCarTypes from '../carTypes.js'
import { SERVICE_PAGES } from '../services.js'
import {
  AIRPORT_CTA,
  AIRPORT_DRIVES,
  AIRPORT_FAQS,
  AIRPORT_HERO,
  AIRPORT_LOCATION,
  AIRPORT_META,
  AIRPORT_PATH,
  AIRPORT_PICKUP,
  AIRPORT_STEPS,
  AIRPORT_TYPES,
  AIRPORT_WHY,
} from '../airport.js'
import {
  CONTACT_EMAIL,
  CONTACT_PHONE,
  WHATSAPP_NUMBER,
  mailtoHref,
  rentalDays,
  shortDate,
  telHref,
  whatsappHref,
} from '../constants.js'
import '../site.css'

const NAV = [
  { href: '#how', label: 'How it works' },
  { href: '#cars', label: 'Cars' },
  { href: '#faq', label: 'FAQs' },
]

const WA_TEXT = 'Hi, I want to rent a self-drive car at Cochin Airport'

// The whole fleet fits in one request (the API allows up to 50 per page)
const FLEET_LIMIT = 50

const FAQ_GROUPS = [{ title: '', items: AIRPORT_FAQS }]

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// Call + WhatsApp buttons (hero and the closing strip)
function ContactButtons({ callClass }) {
  return (
    <>
      <a href={telHref(CONTACT_PHONE)} className={`sg-btn ${callClass}`}>
        <Icon name="phone" size={18} /> Call {CONTACT_PHONE}
      </a>
      {WHATSAPP_NUMBER && (
        <a
          href={whatsappHref(WHATSAPP_NUMBER, WA_TEXT)}
          className="sg-btn sg-btn--whatsapp"
          target="_blank"
          rel="noreferrer"
        >
          <Icon name="chat" size={18} /> WhatsApp
        </a>
      )}
    </>
  )
}

// Cochin / Kochi Airport car rental page (text in airport.js). Also
// pre-rendered to plain HTML at build time (scripts/prerender.js).
export default function AirportRental() {
  const [type, setType] = useState('')
  const [cars, setCars] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [trip, setTrip] = useState(null)
  const [bookingCar, setBookingCar] = useState(null)
  const carTypes = useCarTypes()
  const types = carTypes.types.filter((t) => AIRPORT_TYPES.includes(t.value))

  useEffect(() => {
    document.title = AIRPORT_META.title
    window.scrollTo(0, 0)
  }, [])

  const load = useCallback(async (selectedType) => {
    setLoading(true)
    setError('')
    try {
      const res = await getCars({ type: selectedType, limit: FLEET_LIMIT })
      setCars(res.data.filter((c) => AIRPORT_TYPES.includes(c.type)))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(type)
  }, [type, load])

  useReveal(`${type}|${cars.length}|${loading}`)

  const closeModal = useCallback(() => setBookingCar(null), [])

  function onSearch(t) {
    setTrip(t)
    setType(t.type)
    scrollToId('cars')
  }

  function pickType(value) {
    setType(value)
    scrollToId('cars')
  }

  const days = rentalDays(trip)
  const otherServices = SERVICE_PAGES.filter((s) => s.path !== AIRPORT_PATH)

  return (
    <div className="sg sg-svc">
      <SiteHeader nav={NAV} />

      <nav className="sg-wrap sg-crumbs" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link to="/">Home</Link>
          </li>
          <li aria-current="page">{AIRPORT_META.breadcrumb}</li>
        </ol>
      </nav>

      <section className="sg-hero sg-hero--svc" aria-labelledby="svc-title">
        <div className="sg-wrap sg-hero__grid">
          <div className="sg-hero__copy">
            <p className="sg-kicker">
              <span className="sg-dot" />
              <span>{AIRPORT_HERO.kicker}</span>
            </p>
            <h1 id="svc-title">{AIRPORT_HERO.title}</h1>
            <p className="sg-hero__lead">{withTodos(AIRPORT_HERO.intro)}</p>
            <ul className="sg-trust">
              {AIRPORT_HERO.chips.map((c) => (
                <li key={c}>
                  <Icon name="check" size={16} />
                  <span>{withTodos(c)}</span>
                </li>
              ))}
            </ul>
            <div className="sg-actions">
              <ContactButtons callClass="sg-btn--ink" />
            </div>
          </div>

          <figure className="sg-hero__photo">
            <img src="/images/hero.webp" alt={AIRPORT_HERO.imageAlt} />
            <figcaption className="sg-stone" aria-hidden="true">
              <span>COK</span>
              <strong>0</strong>
              <small>km</small>
            </figcaption>
          </figure>
        </div>

        <div id="book" className="sg-wrap">
          <SearchWidget
            initial={{ pickupLocation: AIRPORT_LOCATION }}
            showFlight
            onlyTypes={AIRPORT_TYPES}
            onSearch={onSearch}
          />
        </div>
      </section>

      <section id="how" className="sg-road sg-road--svc" aria-labelledby="how-title">
        <div className="sg-wrap">
          <div className="sg-head reveal">
            <p className="sg-kicker">How it works</p>
            <h2 id="how-title">
              From the gate to the <em>open road</em>
            </h2>
          </div>
          <ol className="sg-road__steps">
            {AIRPORT_STEPS.map((s, i) => (
              <li key={s.title} className="reveal" style={{ '--i': i }}>
                <span className="sg-stone sg-stone--sm" aria-hidden="true">
                  <span>Step</span>
                  <strong>{i + 1}</strong>
                </span>
                <div>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="sg-road__lane" aria-hidden="true" />
      </section>

      <section id="cars" className="sg-section sg-wrap" aria-labelledby="cars-title">
        <div className="sg-head reveal">
          <p className="sg-kicker">The fleet</p>
          <h2 id="cars-title">
            Cars available at <em>Cochin Airport</em>
          </h2>
        </div>

        {trip && (
          <div className="sg-tripbar">
            <span>
              <Icon name="calendar" size={16} />
              {shortDate(trip.startDate)} {trip.pickupTime} → {shortDate(trip.endDate)} {trip.dropoffTime}
              {days > 0 && (
                <strong>
                  {days} {days === 1 ? 'day' : 'days'}
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
            {trip.flightNumber && <span>Flight {trip.flightNumber}</span>}
            <button className="sg-textbtn" onClick={() => scrollToId('book')}>
              Change trip
            </button>
          </div>
        )}

        <nav className="sg-filters" aria-label="Car types">
          {[{ value: '', label: 'All' }, ...types].map((t) => (
            <button
              key={t.value || 'all'}
              className={`sg-filter ${type === t.value ? 'is-active' : ''}`}
              aria-pressed={type === t.value}
              onClick={() => setType(t.value)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {error && (
          <div className="sg-note sg-note--error">
            {error}{' '}
            <button className="sg-textbtn" onClick={() => load(type)}>
              Try again
            </button>
          </div>
        )}

        {!error && !loading && cars.length === 0 && (
          <div className="sg-empty">
            <p className="sg-empty__big">Nothing parked here right now.</p>
            <p>
              Call us on <a href={telHref(CONTACT_PHONE)}>{CONTACT_PHONE}</a> and we'll help you find a{' '}
              {type ? carTypes.label(type).toLowerCase() : 'car'} for your arrival.
            </p>
          </div>
        )}

        <div className="sg-grid">
          {cars.map((car, i) => (
            <div key={car.id} className="reveal" style={{ '--i': i % 4 }}>
              <CarCard car={car} days={days} priceFrom onBook={setBookingCar} />
            </div>
          ))}
          {loading && Array.from({ length: 4 }, (_, i) => <div key={i} className="sg-ticket sg-ticket--skeleton" />)}
        </div>
      </section>

      <section id="why" className="sg-section sg-wrap sg-prose" aria-labelledby="why-title">
        <div className="sg-prose__head reveal">
          <p className="sg-kicker">Self-drive vs taxi</p>
          <h2 id="why-title">{AIRPORT_WHY.title}</h2>
        </div>
        <div className="sg-prose__body reveal">
          {AIRPORT_WHY.body.map((p) => (
            <p key={p}>{withTodos(p)}</p>
          ))}
        </div>
      </section>

      <section id="pickup" className="sg-section sg-wrap sg-prose sg-prose--rule" aria-labelledby="pickup-title">
        <div className="sg-prose__head reveal">
          <p className="sg-kicker">Handover</p>
          <h2 id="pickup-title">{AIRPORT_PICKUP.title}</h2>
        </div>
        <div className="sg-prose__body reveal">
          {AIRPORT_PICKUP.body.map((p) => (
            <p key={p}>{withTodos(p)}</p>
          ))}
        </div>
      </section>

      <section className="sg-section sg-asphalt" aria-labelledby="drives-title">
        <div className="sg-wrap">
          <div className="sg-head reveal">
            <p className="sg-kicker">Road trips</p>
            <h2 id="drives-title">
              Popular drives from <em>Cochin Airport</em>
            </h2>
          </div>
          <ul className="sg-drives">
            {AIRPORT_DRIVES.map((d, i) => (
              <li key={d.place} className="reveal" style={{ '--i': i % 3 }}>
                <span>{d.place}</span>
                <strong>{d.time}</strong>
              </li>
            ))}
          </ul>
          <p className="sg-drives__note">Driving times are approximate and depend on traffic.</p>
        </div>
      </section>

      <section id="faq" className="sg-section sg-wrap sg-faq" aria-labelledby="faq-title">
        <div className="sg-faq__head reveal">
          <p className="sg-kicker">FAQs</p>
          <h2 id="faq-title">
            Cochin Airport car rental <em>questions</em>
          </h2>
          <p>
            Something else? Call <a href={telHref(CONTACT_PHONE)}>{CONTACT_PHONE}</a> or email{' '}
            <a href={mailtoHref(CONTACT_EMAIL)}>{CONTACT_EMAIL}</a>.
          </p>
        </div>
        <FaqList groups={FAQ_GROUPS} firstOpen />
      </section>

      <section className="sg-section sg-wrap sg-more-svc" aria-labelledby="services-title">
        <div className="sg-head reveal">
          <p className="sg-kicker">Other services</p>
          <h2 id="services-title">
            Not flying in? <em>We cover Kochi too.</em>
          </h2>
        </div>
        <ul className="sg-services">
          {otherServices.map((s, i) => (
            <li key={s.path} className="reveal" style={{ '--i': i }}>
              <Link to={s.path}>
                <span>{s.label}</span>
                <Icon name="arrow" size={22} />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="sg-call" aria-labelledby="cta-title">
        <div className="sg-wrap sg-call__inner reveal">
          <p className="sg-kicker">Book your airport car</p>
          <h2 id="cta-title">
            {AIRPORT_CTA.title} <em>{AIRPORT_CTA.em}</em>
          </h2>
          <div className="sg-actions">
            <button className="sg-btn sg-btn--ink" onClick={() => scrollToId('book')}>
              Book now <Icon name="arrow" size={18} />
            </button>
            <ContactButtons callClass="sg-btn--outline" />
          </div>
        </div>
      </section>

      <SiteFooter nav={NAV} carTypes={types} onPickType={pickType} />

      <WhatsAppFloat text={WA_TEXT} />

      {bookingCar && <EnquiryModal car={bookingCar} trip={trip} askFlight onClose={closeModal} />}
    </div>
  )
}
