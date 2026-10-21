// Text of the Cochin / Kochi Airport car rental page
// (pages/AirportRental.jsx). scripts/prerender.js also reads it for the
// page's title, description and structured data (FAQs, breadcrumbs).
//
// Placeholders still to fill in are written "[TODO: ...]", "[CONFIRM: ...]"
// or "[PRICE]"; the page shows them highlighted (components/Todo.jsx).

export const AIRPORT_PATH = '/kochi-airport-car-rental'

// Lowest starting daily rate (the 5-seaters), shown in the search result
// description. Keep it in line with the FAQ about prices below.
const FROM_PRICE = '₹1,300'

export const AIRPORT_META = {
  title: 'Self-Drive Car Rental at Cochin Airport | Drive Kochi',
  description: `Self-drive car rental at Cochin International Airport (COK). Car handed over at arrivals, no account needed. Hatchbacks, sedans, SUVs and vans from ${FROM_PRICE}/day.`,
  breadcrumb: 'Cochin Airport Car Rental',
}

export const AIRPORT_HERO = {
  kicker: 'Kochi Airport · COK',
  title: 'Self-Drive Car Rentals at Cochin International Airport',
  intro:
    'Land at COK, collect your car at arrivals and drive. No account needed: send a free request and we call to confirm.',
  chips: ['No account needed', 'Meet at arrivals', 'Deposit back in 3 working days'],
  imageAlt: 'A self-drive rental car on an open road in Kerala at sunset',
}

// Shown pre-selected in the booking box
export const AIRPORT_LOCATION = 'Kochi Airport'

// Car types offered at the airport, in this order
export const AIRPORT_TYPES = ['hatchback', 'sedan', 'suv', 'van', 'luxury']

export const AIRPORT_STEPS = [
  {
    title: 'Send your dates and flight number',
    text: 'Use the booking box on this page, or call or WhatsApp us. Add your flight number if you have it.',
  },
  {
    title: 'We call to confirm car and price',
    text: 'We check which cars are free for your dates and call you back with the final price.',
  },
  {
    title: 'Meet us at arrivals with your licence and ID',
    text: 'Bring your driving licence and a government ID. We hand you the keys at Cochin Airport arrivals.',
  },
  {
    title: 'Drive, and return at the airport or another pickup point',
    text: 'Bring the car back to Kochi Airport, or drop it at one of our other pickup points.',
  },
]

export const AIRPORT_WHY = {
  title: 'Why rent at the airport instead of taking a taxi',
  body: [
    "Cochin International Airport is in Nedumbassery, roughly an hour's drive from Ernakulam. A taxi or prepaid cab is easy for that first ride, but the fares add up fast once you count the trip back, a few days of getting around Kochi, or a run up to Munnar, Alleppey or Thekkady.",
    "With a self-drive car from Kochi Airport, one daily rate covers all of it. That works especially well for families and groups: there's room for everyone's luggage, nobody waits for a driver, and you can stop for tea on the ghat road or stay longer at the beach without watching a meter. You decide when to leave, which way to go and where to stop for the night.",
    'For a single short ride to a hotel near the airport, a cab may still be simpler. For a longer stay or a road trip, your own car is usually better value and far more flexible.',
  ],
}

export const AIRPORT_PICKUP = {
  title: 'Pickup and return at Cochin Airport',
  body: [
    'We hand over cars at the arrivals area of Cochin International Airport. Before you land, we send you the meeting point and the number of the person bringing your car.',
    'Add your flight number when you book and we track your flight, so if it lands early or late, we move the handover time to match.',
    "When your trip is over, return the car at the departures area of Kochi Airport, or drop it at Vytilla Hub, KSRTC Ernakulam or Nedumbassery if that suits your plans better. Just tell us when you book.",
    "Landing late at night or very early in the morning? We can still meet you. There's no fixed charge for this, but an extra charge may apply depending on the time; we'll tell you the amount when we confirm your booking.",
  ],
}

export const AIRPORT_DRIVES = [
  { place: 'Ernakulam / MG Road', time: '~1 hr' },
  { place: 'Fort Kochi & Mattancherry', time: '~1.5 hr' },
  { place: 'Alleppey', time: '~2 hr' },
  { place: 'Munnar', time: '~3.5–4 hr' },
  { place: 'Thekkady', time: '~4.5 hr' },
  { place: 'Varkala', time: '~4.5 hr' },
]

export const AIRPORT_FAQS = [
  {
    q: 'How do I rent a self-drive car at Cochin International Airport?',
    a: 'Send a booking request on this page, call or WhatsApp us. We confirm the car and price by phone, then meet you at arrivals with the car.',
  },
  {
    q: 'Do I need to create an account?',
    a: "No. There's no sign-up. Send a free booking request, call or WhatsApp us, and we call you back to confirm the car and the price.",
  },
  {
    q: 'How much does it cost to rent a car at Cochin Airport?',
    a: '5-seaters start from ₹1,300/day, sedans from ₹2,200, MUVs from ₹2,700 and 7-seaters from ₹2,800. The final price depends on the car, season and trip length.',
  },
  {
    q: 'Where exactly do I collect the car?',
    a: "At the arrivals area of Cochin International Airport. We'll share the exact meeting point and the driver's number before you land.",
  },
  {
    q: 'What happens if my flight is delayed?',
    a: 'Add your flight number when you book. We track the flight and adjust the handover time.',
  },
  {
    q: 'Can I pick up the car late at night or early morning?',
    a: "Yes. Tell us your arrival time when you book. There's no fixed late-night or early-morning charge, but an extra charge may apply depending on the time. We'll tell you the amount when we confirm your booking.",
  },
  {
    q: 'Can I return the car somewhere other than the airport?',
    a: 'Yes. You can drop it at Vytilla Hub, KSRTC Ernakulam or Nedumbassery, or pick up in the city and return at the airport. Tell us when booking.',
  },
  {
    q: 'What documents do I need?',
    a: 'A valid driving licence held for at least 1 year and a government ID (Aadhaar, passport or voter ID). Minimum age is 21.',
  },
  {
    q: 'Can foreign tourists and NRIs rent a car at Cochin Airport?',
    a: 'Yes, with a passport, valid visa, home-country licence and an International Driving Permit.',
  },
  {
    q: 'Is there a kilometre limit, and what is the fuel policy?',
    a: 'Every rental includes 140 km per day. Extra kilometres cost ₹10 to ₹15 per km, depending on the car. The fuel arrangement is set as per your requirement; we agree it with you when we confirm your booking.',
  },
  {
    q: 'How much is the security deposit, and when do I get it back?',
    a: "The deposit depends on the car you rent; we'll tell you the amount when we confirm your booking. It's refunded within 3 working days of returning the car, after deductions for any damage or fines.",
  },
  {
    q: 'Can I take the car outside Kerala?',
    a: "Yes. Our cars have an interstate permit, so you can drive outside Kerala, and there's no extra charge for it.",
  },
]

export const AIRPORT_CTA = {
  title: 'Flying into Kochi?',
  em: 'Your car can be waiting.',
}
