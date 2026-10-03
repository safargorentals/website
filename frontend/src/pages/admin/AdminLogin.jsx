import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminLogin, adminMe } from '../../api.js'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Already signed in? Go straight to the dashboard.
  useEffect(() => {
    adminMe()
      .then(() => navigate('/admin/dashboard', { replace: true }))
      .catch(() => {})
  }, [navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await adminLogin(email.trim(), password)
      navigate('/admin/dashboard', { replace: true })
    } catch (err) {
      setError(err.fields?.email || err.fields?.password || err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <a href="/" className="logo">
          Safar<span>Go</span>
        </a>
        <h1>Admin login</h1>

        <label className="field">
          <span>Email</span>
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
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
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
