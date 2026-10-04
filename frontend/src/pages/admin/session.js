import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminLogout, adminMe } from '../../api.js'

// Admin session helpers. The session itself is an httpOnly cookie the
// browser cannot read, so "am I signed in?" is always asked of the API
// (GET /api/admin/me).
//
// Rule: leaving the dashboard ends the session. Back/Forward, the logo link,
// or coming back to the dashboard from another website all log out; only a
// refresh keeps you signed in.

// Tells other open admin tabs about a logout, so they close the dashboard
// straight away instead of on their next request.
const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('drive-kochi-admin') : null

export function announceLogout() {
  channel?.postMessage('logout')
}

// Re-check at most this often when the tab regains focus
const RECHECK_MS = 30 * 1000

// How this page load started. 'back_forward' means the browser's Back or
// Forward brought us here from another page or site, i.e. the admin left
// the dashboard and came back. Only the first dashboard visit of a page
// load can be that; later ones are navigation inside the app.
let firstVisitThisLoad = true
function arrivedWithBackForward() {
  const wasFirst = firstVisitThisLoad
  firstVisitThisLoad = false
  return wasFirst && performance.getEntriesByType?.('navigation')[0]?.type === 'back_forward'
}

// Guards admin pages. Renders nothing until the API confirms the session,
// then re-checks it whenever the page could be showing stale data. Any
// failure replaces the page with the login screen (replace: the dashboard
// never stays in history after it is lost).
export function useAdminSession() {
  const navigate = useNavigate()
  const [email, setEmail] = useState(null)
  const lastCheck = useRef(0)
  const ending = useRef(false)

  const leave = useCallback(
    (reason) => navigate('/admin', { replace: true, state: { reason } }),
    [navigate],
  )

  // Log out on the server, tell other tabs, then go to the login page (or
  // run "then" instead, e.g. to open the website)
  const endSession = useCallback(
    async (then) => {
      if (ending.current) return
      ending.current = true
      setEmail(null)
      await adminLogout().catch(() => {})
      announceLogout()
      if (then) then()
      else leave('signedOut')
    },
    [leave],
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
    if (arrivedWithBackForward()) {
      endSession()
      return
    }
    check('required')

    // Back button: an extra history entry means Back first lands here, on
    // the dashboard; the popstate that follows logs out instead of leaving
    // the admin with the session still open.
    window.history.pushState(window.history.state, '', window.location.href)
    const onPopState = () => endSession()

    // Restored from the back/forward cache = came back from elsewhere
    const onPageShow = (e) => e.persisted && endSession()
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastCheck.current > RECHECK_MS) check()
    }
    const onMessage = (e) => e.data === 'logout' && leave('signedOut')

    window.addEventListener('popstate', onPopState)
    window.addEventListener('pageshow', onPageShow)
    document.addEventListener('visibilitychange', onVisible)
    channel?.addEventListener('message', onMessage)
    return () => {
      window.removeEventListener('popstate', onPopState)
      window.removeEventListener('pageshow', onPageShow)
      document.removeEventListener('visibilitychange', onVisible)
      channel?.removeEventListener('message', onMessage)
    }
  }, [check, leave, endSession])

  // For child tabs: any 401 from the API means the session is gone
  const onUnauthorized = useCallback(() => leave('expired'), [leave])

  return { email, onUnauthorized, endSession }
}
