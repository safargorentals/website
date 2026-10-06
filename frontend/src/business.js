import { CONTACT_PHONE } from './constants.js'

// Business details for search engines (Google's business info, link
// previews) and the website footer. Fill in the empty values: anything left
// empty is simply left out. Keep the name, address and phone exactly as they
// appear on your Google Business Profile.
export const BUSINESS = {
  name: 'Drive Kochi',
  legalName: 'AVS Rent A Car',
  description:
    'Self-drive car rentals in Kochi: SUVs, sedans, hatchbacks, vans and more at clear daily prices. Pickup at Kochi Airport, Ernakulam and other places across Kochi.',
  phone: CONTACT_PHONE,
  email: '',
  address: {
    street: '', // e.g. '12/345, MG Road'
    locality: 'Kochi',
    region: 'Kerala',
    postalCode: '', // e.g. '682016'
    country: 'IN',
  },
  // Map pin of the office, e.g. { lat: 9.9816, lng: 76.2999 }
  geo: null,
  // Link to the Google Maps / Google Business Profile page
  mapUrl: '',
  // e.g. [{ days: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'], opens: '08:00', closes: '21:00' }]
  hours: [],
  priceRange: '₹₹',
  areaServed: ['Kochi', 'Ernakulam', 'Kerala'],
  // Instagram, Facebook, Google Business Profile, ... links
  sameAs: [],
}

// "12/345, MG Road, Kochi, Kerala 682016" (empty parts skipped)
export function addressLine(a = BUSINESS.address) {
  const region = [a.region, a.postalCode].filter(Boolean).join(' ')
  return a.street ? [a.street, a.locality, region].filter(Boolean).join(', ') : ''
}
