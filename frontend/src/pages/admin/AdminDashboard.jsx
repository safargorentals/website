import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminLogout, adminMe } from '../../api.js'
import CarsTab from './CarsTab.jsx'
import EnquiriesTab from './EnquiriesTab.jsx'

const TABS = [
  { key: 'cars', label: 'Cars' },
  { key: 'enquiries', label: 'Enquiries' },
]

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [email, setEmail] = useState(null)
  const [tab, setTab] = useState('cars')

  useEffect(() => {
    adminMe()
      .then((res) => setEmail(res.email))
      .catch(() => navigate('/admin', { replace: true }))
  }, [navigate])

  // Any 401 from a child tab means the session expired
  const onUnauthorized = useCallback(() => navigate('/admin', { replace: true }), [navigate])

  async function logout() {
    await adminLogout().catch(() => {})
    navigate('/admin', { replace: true })
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
            <button className="btn btn--ghost btn--sm" onClick={logout}>
              Log out
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
        {tab === 'enquiries' && <EnquiriesTab onUnauthorized={onUnauthorized} />}
      </div>
    </div>
  )
}
