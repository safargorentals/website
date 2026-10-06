// FAQs shown on the home page, also sent to search engines as FAQ data
// (see scripts/prerender.js). Grouped by topic; numbering runs on across
// the groups.
export const FAQ_GROUPS = [
  {
    title: 'Booking and enquiries',
    items: [
      {
        q: 'How do I book a car?',
        a: "Send an enquiry through the site, or call or WhatsApp us. We'll confirm availability and the price, then finalise your booking.",
      },
      {
        q: 'Do I pay online when I submit an enquiry?',
        a: "No. Submitting an enquiry doesn't charge you or commit you to anything. Payment is arranged once we confirm your booking.",
      },
      {
        q: 'How quickly will you reply?',
        a: 'We aim to respond within 30-40 mins. For urgent bookings, please call us.',
      },
      {
        q: 'How early should I book?',
        a: 'We recommend booking 2-3 days ahead, and earlier for weekends, festivals and holiday season.',
      },
      {
        q: 'Can I rent a car for just a few hours?',
        a: 'Yes, hourly / half-day / full-day packages are available. Ask us for the options.',
      },
    ],
  },
  {
    title: 'Eligibility and documents',
    items: [
      {
        q: 'What documents do I need?',
        a: 'A valid driving license and a government ID (Aadhaar, passport or voter ID). We may also ask for address proof.',
      },
      {
        q: 'What is the minimum age to rent?',
        a: '21 years, with a license held for at least 1 year.',
      },
      {
        q: 'Can foreign tourists rent a car?',
        a: 'Yes, with a valid passport, visa and an International Driving Permit along with their home license.',
      },
    ],
  },
  {
    title: 'Pricing and payments',
    items: [
      {
        q: 'How is the rental priced?',
        a: 'Cars are priced per day. The price shown on the site is a starting rate and may vary by car, season and trip length.',
      },
      {
        q: 'Is there a security deposit?',
        a: "Yes. It's refunded within 3 working days of returning the car, after deductions for any damage or fines.",
      },
    ],
  },
]
