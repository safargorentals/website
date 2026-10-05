import { useEffect, useSyncExternalStore } from 'react'
import { getLocations } from './api.js'

// Pickup / drop-off locations are managed in the admin panel (Locations
// tab) and loaded from the API once per page load. Until they arrive (or if
// the request fails) this starting list is used.
export const DEFAULT_LOCATIONS = [
  { id: 'kochi-airport', name: 'Kochi Airport', tag: 'pickup' },
  { id: 'ksrtc-ernakulam', name: 'KSRTC Ernakulam', tag: 'pickup' },
  { id: 'nedumbassery', name: 'Nedumbassery', tag: 'pickup' },
  { id: 'tvm-airport', name: 'TVM Airport', tag: 'pickup' },
  { id: 'varkala-branch', name: 'Varkala Branch', tag: 'yard' },
  { id: 'vytilla-hub', name: 'Vytilla Hub', tag: 'pickup' },
]

let locations = DEFAULT_LOCATIONS
let requested = false
const listeners = new Set()

function setLocations(list) {
  locations = list
  listeners.forEach((l) => l())
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function refreshLocations() {
  return getLocations().then((res) => {
    if (Array.isArray(res.data)) setLocations(res.data)
  })
}

// Lets the admin panel push its fresh list without another request
export function replaceLocations(list) {
  setLocations(list)
}

// "Kochi Airport (pickup)"
export const locationLabel = (l) => (l.tag ? `${l.name} (${l.tag})` : l.name)

export default function useLocations() {
  const list = useSyncExternalStore(subscribe, () => locations)

  useEffect(() => {
    if (requested) return
    requested = true
    refreshLocations().catch(() => {
      requested = false
    })
  }, [])

  return list
}
