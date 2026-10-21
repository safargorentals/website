import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from './Icon.jsx'
import Logo, { LogoWord } from './Logo.jsx'
import { LegalLinks } from '../pages/Legal.jsx'
import useTheme from '../theme.js'
import { useIsAdmin } from '../pages/admin/session.js'
import { BUSINESS, addressLine } from '../business.js'
import { SERVICE_PAGES } from '../services.js'
import { CONTACT_EMAIL, CONTACT_PHONE, WHATSAPP_NUMBER, mailtoHref, telHref, whatsappHref } from '../constants.js'

const YEAR = new Date().getFullYear()

const pad = (n) => String(n).padStart(2, '0')

// Sticky site header (home page and service pages). nav: in-page links,
// [{ href: '#fleet', label: 'Fleet' }, ...]
export function SiteHeader({ nav }) {
  // A logged-in admin sees the website normally, plus a Dashboard button
  const isAdmin = useIsAdmin()
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [theme, toggleTheme] = useTheme()

  // Header tightens up once the page is scrolled
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={`sg-header ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="sg-wrap sg-header__inner">
        <a href="/" className="sg-logo" aria-label="Drive Kochi home">
          <span className="sg-logo__sign" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path d="M7 20V11a3 3 0 0 1 3-3h8M14 4l4 4-4 4" />
            </svg>
          </span>
          <LogoWord tagline />
        </a>
        <nav className={`sg-nav ${menuOpen ? 'is-open' : ''}`} aria-label="Main">
          {nav.map((n, i) => (
            <a key={n.href} href={n.href} onClick={() => setMenuOpen(false)}>
              <small>{pad(i + 1)}</small>
              {n.label}
            </a>
          ))}
        </nav>
        {isAdmin && (
          <Link to="/admin/dashboard" className="sg-btn sg-btn--yellow sg-admin-link">
            <span className="sg-admin-link__full">Dashboard</span>
            <span className="sg-admin-link__short">Admin</span>
            <Icon name="arrow" size={16} />
          </Link>
        )}
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
  )
}

// Site footer. nav: the "Explore" links; carTypes + onPickType: the "Car
// types" buttons (each page decides what picking a type does)
export function SiteFooter({ nav, carTypes, onPickType }) {
  return (
    <footer className="sg-footer">
      <div className="sg-wrap sg-footer__grid">
        <div className="sg-footer__about">
          <a href="/" className="sg-footer__logo dk-logo dk-logo--night" aria-label="Drive Kochi home">
            <Logo size={40} tagline />
          </a>
          <p>Self-drive car rentals for city trips, weekends away and long journeys.</p>
          <small>Drive Kochi is a unit of AVS Rent A Car.</small>
        </div>
        <div>
          <h3>Explore</h3>
          {nav.map((n) => (
            <a key={n.href} href={n.href}>
              {n.label}
            </a>
          ))}
        </div>
        <div>
          <h3>Services</h3>
          {SERVICE_PAGES.filter((s) => s.live).map((s) => (
            <Link key={s.path} to={s.path}>
              {s.label}
            </Link>
          ))}
        </div>
        <div>
          <h3>Car types</h3>
          {carTypes.map((t) => (
            <button key={t.value} onClick={() => onPickType(t.value)}>
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
          <a href={mailtoHref(CONTACT_EMAIL)}>{CONTACT_EMAIL}</a>
          {addressLine() &&
            (BUSINESS.mapUrl ? (
              <a href={BUSINESS.mapUrl} target="_blank" rel="noreferrer">
                <address>{addressLine()}</address>
              </a>
            ) : (
              <address>{addressLine()}</address>
            ))}
        </div>
      </div>
      <p className="sg-footer__word" aria-hidden="true">
        <LogoWord />
      </p>
      <div className="sg-wrap sg-footer__bottom">
        <span>© {YEAR} Drive Kochi · A unit of AVS Rent A Car</span>
        <LegalLinks />
      </div>
    </footer>
  )
}

// Floating WhatsApp button (bottom right)
export function WhatsAppFloat({ text = 'Hi, I want to rent a car' }) {
  if (!WHATSAPP_NUMBER) return null
  return (
    <a
      className="sg-wa"
      href={whatsappHref(WHATSAPP_NUMBER, text)}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat on WhatsApp"
    >
      <Icon name="chat" size={24} />
    </a>
  )
}
