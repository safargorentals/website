import { useEffect, useState } from 'react'
import CarsTab from './CarsTab.jsx'
import CarTypesTab from './CarTypesTab.jsx'
import EnquiriesTab from './EnquiriesTab.jsx'
import LocationsTab from './LocationsTab.jsx'
import { useAdminSession } from './session.js'
import Logo from '../../components/Logo.jsx'

const TABS = [
  { key: 'cars', label: 'Cars' },
  { key: 'types', label: 'Car types' },
  { key: 'locations', label: 'Locations' },
  { key: 'enquiries', label: 'Enquiries' },
]

export default function AdminDashboard() {
  const { email, onUnauthorized, endSession } = useAdminSession()
  const [tab, setTab] = useState('cars')
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    document.title = 'Admin · Drive Kochi'
  }, [])

  function logout() {
    setLoggingOut(true)
    endSession()
  }

  // Leaving the admin for the website also logs out
  function goToWebsite(e) {
    e.preventDefault()
    endSession(() => window.location.assign('/'))
  }

  if (!email) return <div className="page-loading">Loading…</div>

  return (
    <div className="admin">
      <header className="admin__header">
        <div className="container admin__header-inner">
          <a href="/" className="logo dk-logo" onClick={goToWebsite} title="Log out and open the website" aria-label="Drive Kochi admin: log out and open the website">
            <Logo size={30} /> <small>Admin</small>
          </a>
          <div className="admin__user">
            <span>{email}</span>
            <button className="btn btn--ghost btn--sm" onClick={logout} disabled={loggingOut}>
              {loggingOut ? 'Logging out…' : 'Log out'}
            </button>
          </div>
        </div>
      </header>

      <div className="container section">
        <nav className="tabs">
          {TABS.map((t) => (
            <button key={t.key} className={`tab ${tab === t.key ? 'tab--active' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </nav>

        {tab === 'cars' && <CarsTab onUnauthorized={onUnauthorized} />}
        {tab === 'types' && <CarTypesTab onUnauthorized={onUnauthorized} />}
        {tab === 'locations' && <LocationsTab onUnauthorized={onUnauthorized} />}
        {tab === 'enquiries' && <EnquiriesTab onUnauthorized={onUnauthorized} />}
      </div>
    </div>
  )
}
