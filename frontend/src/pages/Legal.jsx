import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/Icon.jsx'
import { LogoWord } from '../components/Logo.jsx'
import { CONTACT_PHONE, telHref } from '../constants.js'
import { LEGAL_LIST, UPDATED } from '../legal.js'
import useTheme from '../theme.js'
import '../site.css'

const YEAR = new Date().getFullYear()

// Privacy policy, terms and cancellation policy (text in legal.js). Also
// pre-rendered to plain HTML at build time (scripts/prerender.js).
export default function Legal({ page }) {
  const [theme, toggleTheme] = useTheme()

  useEffect(() => {
    document.title = `${page.title} | Drive Kochi`
    window.scrollTo(0, 0)
  }, [page])

  return (
    <div className="sg sg-legal">
      <header className="sg-header is-scrolled">
        <div className="sg-wrap sg-header__inner">
          <Link to="/" className="sg-logo" aria-label="Drive Kochi home">
            <span className="sg-logo__sign" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path d="M7 20V11a3 3 0 0 1 3-3h8M14 4l4 4-4 4" />
              </svg>
            </span>
            <LogoWord tagline />
          </Link>
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
        </div>
      </header>

      <main className="sg-wrap sg-legal__main">
        <Link to="/" className="sg-legal__back">
          ← Back to home
        </Link>
        <p className="sg-kicker">Last updated {UPDATED}</p>
        <h1>{page.title}</h1>
        <p className="sg-legal__intro">{page.intro}</p>

        {page.sections.map((s) => (
          <section key={s.heading}>
            <h2>{s.heading}</h2>
            {s.body.map((p, i) =>
              Array.isArray(p) ? (
                <ul key={i}>
                  {p.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p key={i}>{p}</p>
              ),
            )}
            {s.link && (
              <p>
                <Link to={s.link.to}>{s.link.label} →</Link>
              </p>
            )}
          </section>
        ))}
      </main>

      <footer className="sg-legal__footer">
        <div className="sg-wrap">
          <LegalLinks />
          <span>© {YEAR} Drive Kochi · A unit of AVS Rent A Car</span>
        </div>
      </footer>
    </div>
  )
}

// Links to every legal page (also used in the home page footer)
export function LegalLinks() {
  return (
    <nav className="sg-legal-links" aria-label="Legal">
      {LEGAL_LIST.map((p) => (
        <Link key={p.path} to={p.path}>
          {p.title}
        </Link>
      ))}
    </nav>
  )
}
