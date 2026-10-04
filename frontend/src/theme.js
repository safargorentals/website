import { useEffect, useState } from 'react'

// Light/dark theme. By default the site follows the system setting (pure CSS,
// prefers-color-scheme). The header toggle can override it: the choice is set
// as data-theme on <html> and saved in localStorage (index.html re-applies it
// before the first paint). Picking the theme the system already uses clears
// the override, so the site goes back to following the system.
const KEY = 'sg-theme'
const query = () => window.matchMedia('(prefers-color-scheme: dark)')
const systemTheme = () => (query().matches ? 'dark' : 'light')

export default function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || systemTheme())

  // Without an override, keep the toggle icon in sync if the system flips
  useEffect(() => {
    const mq = query()
    const onChange = () => {
      if (!document.documentElement.dataset.theme) setTheme(mq.matches ? 'dark' : 'light')
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    const root = document.documentElement
    try {
      if (next === systemTheme()) {
        delete root.dataset.theme
        localStorage.removeItem(KEY)
      } else {
        root.dataset.theme = next
        localStorage.setItem(KEY, next)
      }
    } catch {
      // Storage can be blocked (private mode); the theme still changes for this visit
      root.dataset.theme = next
    }
    setTheme(next)
  }

  return [theme, toggle]
}
