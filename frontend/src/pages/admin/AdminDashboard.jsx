import { useEffect, useState } from 'react'
import { adminLogout } from '../../api.js'
import CarsTab from './CarsTab.jsx'
import CarTypesTab from './CarTypesTab.jsx'
import EnquiriesTab from './EnquiriesTab.jsx'
import { announceLogout, useAdminSession } from './session.js'

const TABS = [
  { key: 'cars', label: 'Cars' },
  { key: 'types', label: 'Car types' },
  { key: 'enquiries', label: 'Enquiries' },
]

export default function AdminDashboard() {
  const { email, onUnauthorized, leave } = useAdminSession()
  const [tab, setTab] = useState('cars')
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    document.title = 'Admin · Drive Kochi'
  }, [])

  async function logout() {
    setLoggingOut(true)
    // Even if the request fails (e.g. offline), leave the dashboard
    await adminLogout().catch(() => {})
    announceLogout()
    leave('signedOut')
  }

  if (!email) return <div className="page-loading">Loading…</div>

  return (
    <div className="admin">
      <header className="admin__header">
        <div className="container admin__header-inner">
          <a href="/" className="logo">
            Drive<span>Kochi</span> <small>Admin</small>
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
        {tab === 'enquiries' && <EnquiriesTab onUnauthorized={onUnauthorized} />}
      </div>
    </div>
  )
}
