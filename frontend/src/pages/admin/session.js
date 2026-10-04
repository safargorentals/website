import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminLogout, adminMe } from '../../api.js'

// Admin session helpers. The session itself is an httpOnly cookie the
// browser cannot read, so "am I signed in?" is always asked of the API
// (GET /api/admin/me).
//
// Rules while logged in: the Back button keeps you on the dashboard, and
// opening the website sends you to the dashboard (see useAdminRedirect).
// You leave the admin only by logging out (the Log out button, or the logo,
// which logs out and opens the website).

// Tells other open admin tabs about a logout, so they close the dashboard
// straight away instead of on their next request.
const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('drive-kochi-admin') : null

export function announceLogout() {
  channel?.postMessage('logout')
}

// Re-check at most this often when the tab regains focus
const RECHECK_MS = 30 * 1000

// The server sets this readable cookie next to the session cookie (it
// grants nothing; it only says an admin logged in on this browser)
const HINT = 'admin_hint'
export const hasAdminHint = () => document.cookie.split('; ').some((c) => c === `${HINT}=1`)
const clearAdminHint = () => {
  document.cookie = `${HINT}=; Max-Age=0; Path=/; SameSite=Strict`
}

// For public pages: if an admin is logged in on this browser, go to the
// dashboard (replace, so Back does not return to the website). Returns true
// while that is being checked, so the page can render nothing meanwhile.
export function useAdminRedirect() {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(hasAdminHint)

  useEffect(() => {
    if (!checking) return
    let active = true
    adminMe()
      .then(() => active && navigate('/admin/dashboard', { replace: true }))
      .catch(() => {
        // Session ended (expired, logged out elsewhere): forget the hint
        clearAdminHint()
        if (active) setChecking(false)
      })
    return () => {
      active = false
    }
  }, [checking, navigate])

  return checking
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
        .catch(() => {
        clearAdminHint()
        leave(reason)
      })
    },
    [leave],
  )

  useEffect(() => {
    check('required')

    // Back button: an extra history entry means Back lands here, on the
    // dashboard, and is put straight back - so Back does nothing. If a
    // browser skips that entry anyway, the page it reaches (website or login)
    // sends a logged-in admin back to the dashboard.
    window.history.pushState(window.history.state, '', window.location.href)
    const onPopState = () => {
      if (!ending.current) window.history.pushState(window.history.state, '', window.location.href)
    }

    // Restored from the back/forward cache: make sure the session is alive
    const onPageShow = (e) => e.persisted && check('required')
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
