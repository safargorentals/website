import { useCallback, useEffect, useState } from 'react'
import { adminRunSheetSync, adminSheetSyncStatus } from '../../api.js'

// "5 min ago" from an ISO time
function ago(iso) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso)) / 1000))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

// Google Sheet status bar on the dashboard: link to the sheet, when it last
// synced, rows the sync could not save, and a Sync now button.
export default function SheetSyncPanel({ onUnauthorized }) {
  const [status, setStatus] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')

  const fail = useCallback((err) => (err.status === 401 ? onUnauthorized() : setError(err.message)), [onUnauthorized])

  useEffect(() => {
    let alive = true
    const load = () =>
      adminSheetSyncStatus()
        .then((s) => alive && setStatus(s))
        .catch((err) => alive && fail(err))
    load()
    const timer = setInterval(load, 15000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [fail])

  async function syncNow() {
    setSyncing(true)
    setError('')
    try {
      setStatus(await adminRunSheetSync())
    } catch (err) {
      fail(err)
    } finally {
      setSyncing(false)
    }
  }

  if (!status) return null

  if (!status.configured) {
    return (
      <div className="sheet-sync">
        <div>
          <strong>Google Sheet</strong> <span className="badge badge--muted">Not connected</span>
          <p className="muted">
            Connect a Google Sheet to see and edit cars, locations and enquiries there. Changes go both ways.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="sheet-sync">
      <div>
        <strong>Google Sheet</strong>{' '}
        {status.lastError ? (
          <span className="badge badge--amber">Sync problem</span>
        ) : (
          <span className="badge badge--green">Connected</span>
        )}
        <p className="muted">
          {status.lastCheckAt ? `Up to date, checked ${ago(status.lastCheckAt)}` : 'Not synced yet'} · checks the
          sheet every 10 seconds
          {status.problems > 0 && (
            <>
              {' '}
              · <strong className="sheet-sync__warn">{status.problems} row{status.problems === 1 ? '' : 's'} not saved</strong>{' '}
              (see the Sync note column)
            </>
          )}
        </p>
        {status.lastError && <p className="alert alert--error">{status.lastError}</p>}
        {error && <p className="alert alert--error">{error}</p>}
      </div>
      <div className="sheet-sync__actions">
        <a className="btn btn--ghost btn--sm" href={status.sheetUrl} target="_blank" rel="noreferrer">
          Open sheet
        </a>
        <button className="btn btn--primary btn--sm" onClick={syncNow} disabled={syncing || status.running}>
          {syncing || status.running ? 'Syncing…' : 'Sync now'}
        </button>
      </div>
    </div>
  )
}
