import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminMe } from '../../api.js'

// Admin session helpers. The session itself is an httpOnly cookie the
// browser cannot read, so "am I signed in?" is always asked of the API
// (GET /api/admin/me).

// Tells other open admin tabs about a logout, so they close the dashboard
// straight away instead of on their next request.
const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('drive-kochi-admin') : null

export function announceLogout() {
  channel?.postMessage('logout')
}

// Re-check at most this often when the tab regains focus
const RECHECK_MS = 30 * 1000

// Guards admin pages. Renders nothing until the API confirms the session,
// then re-checks it whenever the page could be showing stale data: restored
// from the back/forward cache, the tab becoming visible again, or a logout
// in another tab. Any failure replaces the page with the login screen
// (replace: the dashboard never stays in history after it is lost).
export function useAdminSession() {
  const navigate = useNavigate()
  const [email, setEmail] = useState(null)
  const lastCheck = useRef(0)

  const leave = useCallback(
    (reason) => navigate('/admin', { replace: true, state: { reason } }),
    [navigate],
  )

  // reason: 'required' when opening the page without a session,
  // 'expired' when a session that was in use has ended
  const check = useCallback(
    (reason = 'expired') => {
      lastCheck.current = Date.now()
      return adminMe()
        .then((res) => setEmail(res.email))
        .catch(() => leave(reason))
    },
    [leave],
  )

  useEffect(() => {
    check('required')

    const onPageShow = (e) => e.persisted && check('required')
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastCheck.current > RECHECK_MS) check()
    }
    const onMessage = (e) => e.data === 'logout' && leave('signedOut')

    window.addEventListener('pageshow', onPageShow)
    document.addEventListener('visibilitychange', onVisible)
    channel?.addEventListener('message', onMessage)
    return () => {
      window.removeEventListener('pageshow', onPageShow)
      document.removeEventListener('visibilitychange', onVisible)
      channel?.removeEventListener('message', onMessage)
    }
  }, [check, leave])

  // For child tabs: any 401 from the API means the session is gone
  const onUnauthorized = useCallback(() => leave('expired'), [leave])

  return { email, onUnauthorized, leave }
}
