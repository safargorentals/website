import { useCallback, useEffect, useState } from 'react'
import { getCars, getFeaturedCars } from '../api.js'
import CarCard from '../components/CarCard.jsx'
import EnquiryModal from '../components/EnquiryModal.jsx'
import Icon from '../components/Icon.jsx'
import SearchWidget from '../components/SearchWidget.jsx'
import useReveal from '../useReveal.js'
import useTheme from '../theme.js'
import { useAdminRedirect } from './admin/session.js'
import useCarTypes from '../carTypes.js'
import useLocations from '../locations.js'
import {
  CONTACT_PHONE,
  WHATSAPP_NUMBER,
  rentalDays,
  shortDate,
  telHref,
  whatsappHref,
} from '../constants.js'
import '../site.css'

const PAGE_SIZE = 12
const YEAR = new Date().getFullYear()

const NAV = [
  { href: '#fleet', label: 'Fleet' },
  { href: '#how', label: 'How it works' },
  { href: '#why', label: 'Why us' },
  { href: '#faq', label: 'FAQs' },
]


const PROMISES = ['No account needed', 'Free booking request', 'Pay after we confirm', 'Pickup where you want']

const BENEFITS = [
  { title: 'Clear daily prices', text: 'The price you see per day is shown up front on every car.' },
  { title: 'Book in minutes', text: 'Pick a car, choose your dates and send a request. No account needed.' },
  { title: 'Quick call-back', text: 'We call you to confirm the car, the price and the pickup details.' },
  { title: 'Your pickup, your drop-off', text: 'Tell us where to hand over and collect the car, even in different places.' },
  { title: 'Well-kept cars', text: 'Every car is cleaned and checked before it goes out on a trip.' },
  { title: 'Real people to talk to', text: 'Questions before or during your trip? Call or WhatsApp us.' },
]

const STEPS = [
  { title: 'Choose your car', text: 'Browse the fleet and pick the car that fits your trip.' },
  { title: 'Pick dates and places', text: 'Tell us when and where you want to pick up and return it.' },
  { title: 'We confirm by phone', text: 'We call you back to confirm availability and the final price.' },
  { title: 'Pick up and drive', text: 'Collect the keys and enjoy the journey.' },
]

// Grouped by topic; numbering runs on across the groups
const FAQ_GROUPS = [
  {
    title: 'Booking and enquiries',
    items: [
      {
        q: 'How do I book a car?',
        a: "Send an enquiry through the site, or call or WhatsApp us. We'll confirm availability and the price, then finalise your booking.",
      },
      {
        q: 'Do I pay online when I submit an enquiry?',
        a: "No. Submitting an enquiry doesn't charge you or commit you to anything. Payment is arranged once we confirm your booking.",
      },
      {
        q: 'How quickly will you reply?',
        a: 'We aim to respond within 30-40 mins. For urgent bookings, please call us.',
      },
      {
        q: 'How early should I book?',
        a: 'We recommend booking 2-3 days ahead, and earlier for weekends, festivals and holiday season.',
      },
      {
        q: 'Can I rent a car for just a few hours?',
        a: 'Yes, hourly / half-day / full-day packages are available. Ask us for the options.',
      },
    ],
  },
  {
    title: 'Eligibility and documents',
    items: [
      {
        q: 'What documents do I need?',
        a: 'A valid driving license, a government ID (Aadhaar, passport or voter ID), and [address proof, if required].',
      },
      {
        q: 'What is the minimum age to rent?',
        a: '21 years, with a license held for at least 1 year.',
      },
      {
        q: 'Can foreign tourists rent a car?',
        a: 'Yes, with a valid passport, visa and an International Driving Permit along with their home license.',
      },
    ],
  },
  {
    title: 'Pricing and payments',
    items: [
      {
        q: 'How is the rental priced?',
        a: 'Pricing is per day / per hour / per km. The price shown on the site is a starting rate and may vary by car, season and duration.',
      },
      {
        q: 'Is there a security deposit?',
        a: "Yes. It's refunded within 3 working days of returning the car, after deductions for any damage or fines.",
      },
    ],
  },
]

const pad = (n) => String(n).padStart(2, '0')

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// Circular text that slowly spins on the hero photo
function RoundBadge() {
  const text = PROMISES.join(' • ') + ' • '
  return (
    <svg className="sg-roundel" viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <path id="sg-roundel-path" d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0" />
      </defs>
      <circle cx="100" cy="100" r="99" className="sg-roundel__disc" />
      <text className="sg-roundel__text">
        <textPath href="#sg-roundel-path" textLength="485">
          {text}
        </textPath>
      </text>
      <path className="sg-roundel__arrow" d="M78 118 L118 78 M90 78 H118 V106" />
    </svg>
  )
}

export default function Home() {
  // A logged-in admin opening the website goes to the dashboard instead
  const checkingAdmin = useAdminRedirect()
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
  const [scrolled, setScrolled] = useState(false)
  const [theme, toggleTheme] = useTheme()
  const { types: carTypes, label: typeLabel, image: typeImage } = useCarTypes()
  // The scrolling band lists the pickup / drop-off locations from the admin
  const locations = useLocations()

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

  useEffect(() => {
    document.title = 'Drive Kochi | Self-drive car rental in Kochi'
  }, [])

  // Featured cars are a nice-to-have; if the request fails the section just stays hidden.
  useEffect(() => {
    getFeaturedCars()
      .then((res) => setFeatured(res.data))
      .catch(() => {})
  }, [])

  // Header tightens up once the page is scrolled
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Re-scan for new .reveal elements whenever the car lists change
  useReveal(`${type}|${cars.length}|${featured.length}|${loading}`)

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

  // Repeat the names so one pass of the band is wider than any screen
  const bandItems = locations.length
    ? Array.from({ length: Math.ceil(12 / locations.length) }, (_, r) => locations.map((l) => ({ ...l, key: `${r}-${l.id}` }))).flat()
    : []

  if (checkingAdmin) return null

  return (
    <div className="sg">
      <div className="sg-strip" aria-hidden="true">
        <div className="sg-strip__track">
          {[0, 1].map((k) => (
            <span key={k}>
              {PROMISES.map((p) => (
                <span key={p}>
                  {p} <i>✦</i>{' '}
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      <header className={`sg-header ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="sg-wrap sg-header__inner">
          <a href="/" className="sg-logo" aria-label="Drive Kochi home">
            <span className="sg-logo__sign" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path d="M7 20V11a3 3 0 0 1 3-3h8M14 4l4 4-4 4" />
              </svg>
            </span>
            <span className="sg-logo__word">
              Drive<span>Kochi</span>
            </span>
          </a>
          <nav className={`sg-nav ${menuOpen ? 'is-open' : ''}`} aria-label="Main">
            {NAV.map((n, i) => (
              <a key={n.href} href={n.href} onClick={() => setMenuOpen(false)}>
                <small>{pad(i + 1)}</small>
                {n.label}
              </a>
            ))}
          </nav>
          <button
            className="sg-theme"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
          </button>
          <a href={telHref(CONTACT_PHONE)} className="sg-btn sg-btn--ink sg-header__call">
            <Icon name="phone" size={16} /> <span>{CONTACT_PHONE}</span>
          </a>
          <button
            className="sg-header__menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <Icon name={menuOpen ? 'close' : 'menu'} size={24} />
          </button>
        </div>
      </header>

      <section className="sg-hero">
        <div className="sg-wrap sg-hero__grid">
          <div className="sg-hero__copy">
            <p className="sg-kicker">
              <span className="sg-dot" />
              <span>Self-drive car rentals</span> <span>by AVS Rent A Car</span>
            </p>
            <h1>
              <span>Drive</span> <span>Kochi</span> <em>your way.</em>
            </h1>
            <p className="sg-hero__lead">
              SUVs, sedans, hatchbacks, vans and more at clear daily prices. Send a free booking request and we'll
              call you to confirm. No account, no advance.
            </p>
          </div>

          <figure className="sg-hero__photo">
            <img src="/images/hero.webp" alt="A car driving down an open road at sunset" />
            <RoundBadge />
            <figcaption className="sg-stone" aria-hidden="true">
              <span>Kochi</span>
              <strong>0</strong>
              <small>km</small>
            </figcaption>
          </figure>
        </div>

        <div className="sg-wrap">
          <SearchWidget onSearch={onSearch} />
        </div>
      </section>

      {bandItems.length > 0 && (
      <div className="sg-band" aria-hidden="true">
        <div className="sg-band__track">
          {[0, 1].map((k) => (
            <span key={k}>
              {bandItems.map((l) => (
                <span key={l.key}>
                  {l.name}
                  <i>✺</i>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>
      )}

      <section className="sg-section sg-wrap" aria-labelledby="types-title">
        <div className="sg-head reveal">
          <p className="sg-kicker">The garage</p>
          <h2 id="types-title">
            What are you <em>driving</em> today?
          </h2>
        </div>
        <ul className="sg-types">
          {carTypes.map((t, i) => (
            <li key={t.value} className="reveal" style={{ '--i': i }}>
              <button className="sg-type" onClick={() => pickType(t.value)}>
                <span className="sg-type__num">{pad(i + 1)}</span>
                <span className="sg-type__name">{t.label}</span>
                <span className="sg-type__blurb">{t.blurb}</span>
                <span className="sg-type__img">
                  <img src={typeImage(t.value)} alt="" loading="lazy" />
                </span>
                <span className="sg-type__go">
                  <Icon name="arrow" size={22} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {featured.length > 0 && (
        <section className="sg-section sg-asphalt" aria-labelledby="featured-title">
          <div className="sg-wrap">
            <div className="sg-head sg-head--row reveal">
              <div>
                <p className="sg-kicker">Driver's picks</p>
                <h2 id="featured-title">
                  The ones people <em>keep booking</em>
                </h2>
              </div>
              <a className="sg-link" href="#fleet">
                See the whole fleet <Icon name="arrow" size={16} />
              </a>
            </div>
            <div className="sg-grid">
              {featured.slice(0, 4).map((car, i) => (
                <div key={car.id} className="reveal" style={{ '--i': i }}>
                  <CarCard car={car} days={days} onBook={setBookingCar} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <main id="fleet" className="sg-section sg-wrap">
        <div className="sg-head sg-head--row reveal">
          <div>
            <p className="sg-kicker">The fleet</p>
            <h2>{type ? <>{typeLabel(type)} cars</> : <>Every car, <em>one place</em></>}</h2>
          </div>
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
            <button className="sg-textbtn" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              Change trip
            </button>
          </div>
        )}

        <nav className="sg-filters" aria-label="Car types">
          {[{ value: '', label: 'All' }, ...carTypes].map((t) => (
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
            <button className="sg-textbtn" onClick={() => load(type, 1)}>
              Try again
            </button>
          </div>
        )}

        {!error && !loading && cars.length === 0 && (
          <div className="sg-empty">
            <p className="sg-empty__big">Nothing parked here right now.</p>
            <p>
              Call us on <a href={telHref(CONTACT_PHONE)}>{CONTACT_PHONE}</a> and we'll help you find a{' '}
              {type ? typeLabel(type).toLowerCase() : 'car'}.
            </p>
          </div>
        )}

        <div className="sg-grid">
          {cars.map((car, i) => (
            <div key={car.id} className="reveal" style={{ '--i': i % 4 }}>
              <CarCard car={car} days={days} onBook={setBookingCar} />
            </div>
          ))}
          {loading &&
            page === 1 &&
            Array.from({ length: 4 }, (_, i) => <div key={i} className="sg-ticket sg-ticket--skeleton" />)}
        </div>

        {page < totalPages && (
          <div className="sg-more">
            <button className="sg-btn sg-btn--outline" disabled={loading} onClick={() => load(type, page + 1)}>
              {loading ? 'Loading…' : 'Show more cars'}
            </button>
          </div>
        )}
      </main>

      <section id="how" className="sg-road" aria-labelledby="how-title">
        <div className="sg-wrap">
          <div className="sg-head reveal">
            <p className="sg-kicker">How it works</p>
            <h2 id="how-title">
              Four milestones to the <em>open road</em>
            </h2>
          </div>
          <ol className="sg-road__steps">
            {STEPS.map((s, i) => (
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

      <section id="why" className="sg-section sg-wrap sg-why" aria-labelledby="why-title">
        <div className="sg-why__lead reveal">
          <p className="sg-kicker">Why Drive Kochi</p>
          <h2 id="why-title">
            No accounts. No advance. <em>Just a call, and the keys.</em>
          </h2>
        </div>
        <ol className="sg-why__list">
          {BENEFITS.map((b, i) => (
            <li key={b.title} className="reveal" style={{ '--i': i % 2 }}>
              <span>{pad(i + 1)}</span>
              <h3>{b.title}</h3>
              <p>{b.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="sg-call">
        <div className="sg-wrap sg-call__inner reveal">
          <p className="sg-kicker">Not sure which car to pick?</p>
          <h2>
            Tell us about your trip. <em>We'll find the car.</em>
          </h2>
          <a className="sg-call__number" href={telHref(CONTACT_PHONE)}>
            {CONTACT_PHONE}
            <Icon name="arrow" size={36} />
          </a>
          {WHATSAPP_NUMBER && (
            <a
              href={whatsappHref(WHATSAPP_NUMBER, 'Hi, I want to rent a car')}
              className="sg-btn sg-btn--whatsapp"
              target="_blank"
              rel="noreferrer"
            >
              <Icon name="chat" size={18} /> Or message us on WhatsApp
            </a>
          )}
        </div>
      </section>

      <section id="faq" className="sg-section sg-wrap sg-faq" aria-labelledby="faq-title">
        <div className="sg-faq__head reveal">
          <p className="sg-kicker">FAQs</p>
          <h2 id="faq-title">
            Questions people <em>ask us</em>
          </h2>
          <p>
            Something else? Call <a href={telHref(CONTACT_PHONE)}>{CONTACT_PHONE}</a>.
          </p>
        </div>
        <div className="sg-faq__list">
          {FAQ_GROUPS.map((g, gi) => {
            const offset = FAQ_GROUPS.slice(0, gi).reduce((n, prev) => n + prev.items.length, 0)
            return (
              <div key={g.title} className="sg-faq__group">
                <h3 className="reveal">{g.title}</h3>
                {g.items.map((f, i) => (
                  <details key={f.q} className="reveal" style={{ '--i': i }}>
                    <summary>
                      <span>{pad(offset + i + 1)}</span>
                      {f.q}
                      <i aria-hidden="true" />
                    </summary>
                    <p>{f.a}</p>
                  </details>
                ))}
              </div>
            )
          })}
        </div>
      </section>

      <footer className="sg-footer">
        <div className="sg-wrap sg-footer__grid">
          <div className="sg-footer__about">
            <p>Self-drive car rentals for city trips, weekends away and long journeys.</p>
            <small>Drive Kochi is a unit of AVS Rent A Car.</small>
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
            {carTypes.map((t) => (
              <button key={t.value} onClick={() => pickType(t.value)}>
                {t.label}
              </button>
            ))}
          </div>
          <div>
            <h3>Contact</h3>
            <a href={telHref(CONTACT_PHONE)}>{CONTACT_PHONE}</a>
            {WHATSAPP_NUMBER && (
              <a href={whatsappHref(WHATSAPP_NUMBER)} target="_blank" rel="noreferrer">
                WhatsApp
              </a>
            )}
          </div>
        </div>
        <p className="sg-footer__word" aria-hidden="true">
          Drive<span>Kochi</span>
        </p>
        <div className="sg-wrap sg-footer__bottom">
          <span>© {YEAR} Drive Kochi · A unit of AVS Rent A Car</span>
          <span>Drive safe. Come back with stories.</span>
        </div>
      </footer>

      {WHATSAPP_NUMBER && (
        <a
          className="sg-wa"
          href={whatsappHref(WHATSAPP_NUMBER, 'Hi, I want to rent a car')}
          target="_blank"
          rel="noreferrer"
          aria-label="Chat on WhatsApp"
        >
          <Icon name="chat" size={24} />
        </a>
      )}

      {bookingCar && <EnquiryModal car={bookingCar} trip={trip} onClose={closeModal} />}
    </div>
  )
}
