import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { adminLogin, adminMe } from '../../api.js'
import Logo from '../../components/Logo.jsx'

// Why the visitor landed here (set by useAdminSession / logout)
const NOTICES = {
  signedOut: 'You have been logged out.',
  expired: 'Your session has ended. Please log in again.',
  required: 'Please log in to continue.',
}

export default function AdminLogin() {
  const navigate = useNavigate()
  const location = useLocation()
  const notice = NOTICES[location.state?.reason]
  const [checking, setChecking] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    document.title = 'Admin login · Drive Kochi'
  }, [])

  // Restored by Back/Forward from the browser's back/forward cache: check
  // again, the admin may have logged in since this page was shown
  useEffect(() => {
    const onPageShow = (e) => e.persisted && setChecking(true)
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

  // Already logged in? Go straight to the dashboard, replacing this page in
  // history so Back does not return to the login form. The form stays
  // hidden until the check finishes, so it never flashes up first.
  useEffect(() => {
    if (!checking) return
    let active = true
    adminMe()
      .then(() => active && navigate('/admin/dashboard', { replace: true }))
      .catch(() => active && setChecking(false))
    return () => {
      active = false
    }
  }, [checking, navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await adminLogin(email.trim(), password)
      setPassword('')
      // replace: the login page is not kept in history behind the dashboard
      navigate('/admin/dashboard', { replace: true })
    } catch (err) {
      setError(err.fields?.email || err.fields?.password || err.message)
      setSubmitting(false)
    }
  }

  if (checking) return <div className="page-loading">Loading…</div>

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <a href="/" className="logo dk-logo" aria-label="Drive Kochi website">
          <Logo size={34} tagline />
        </a>
        <h1>Admin login</h1>

        {notice && !error && <p className="alert alert--info">{notice}</p>}

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {error && <p className="alert alert--error">{error}</p>}

        <button className="btn btn--primary btn--block" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </div>
  )
}
