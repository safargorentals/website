// Service pages (one per search people make, e.g. "car rental Kochi
// airport"). live: the page exists, so the footer links to it. Pages that
// aren't built yet are still linked from the "Other services" section of
// each service page; until they exist those links land on the home page.
export const SERVICE_PAGES = [
  { path: '/kochi-airport-car-rental', label: 'Cochin Airport car rental', live: true },
  { path: '/self-drive-car-rental-kochi', label: 'Self-drive car rental in Kochi', live: false },
  { path: '/monthly-car-rental-kochi', label: 'Monthly car rental in Kochi', live: false },
  { path: '/suv-rental-kochi', label: 'SUV rental in Kochi', live: false },
]
