import { useEffect, useSyncExternalStore } from 'react'
import { getCarTypes } from './api.js'
import { DEFAULT_CAR_TYPES } from './constants.js'

// Car types are managed in the admin panel and loaded from the API once per
// page load. Until they arrive (or if the request fails) the original six
// types are used, so the site never shows an empty list.
let types = DEFAULT_CAR_TYPES
let requested = false
const listeners = new Set()

function setTypes(list) {
  types = list
  listeners.forEach((l) => l())
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// Re-fetch, e.g. after an admin edits the types
export function refreshCarTypes() {
  return getCarTypes().then((res) => {
    if (Array.isArray(res.data) && res.data.length) setTypes(res.data)
  })
}

// Lets the admin panel push its fresh list without another request
export function replaceCarTypes(list) {
  if (list.length) setTypes(list.map(({ value, label, blurb, image }) => ({ value, label, blurb, image })))
}

const FALLBACK_IMAGE = '/images/sedan.webp'

// { types, label(value), image(value) }
export default function useCarTypes() {
  const list = useSyncExternalStore(subscribe, () => types)

  useEffect(() => {
    if (requested) return
    requested = true
    refreshCarTypes().catch(() => {
      requested = false
    })
  }, [])

  return {
    types: list,
    label: (value) => list.find((t) => t.value === value)?.label || value || 'Other',
    image: (value) => list.find((t) => t.value === value)?.image || FALLBACK_IMAGE,
  }
}
