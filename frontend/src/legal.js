import { CONTACT_PHONE } from './constants.js'

// Text of the legal pages (pages/Legal.jsx). Each page is a list of
// sections; a section's body is a list of paragraphs, and a paragraph that
// is an array is shown as a bulleted list.
//
// Have the business owner read these before relying on them, and update
// UPDATED whenever the text changes.

export const UPDATED = '7 October 2026'

const CONTACT = `Call or WhatsApp us on ${CONTACT_PHONE}.`

export const LEGAL_PAGES = {
  privacy: {
    path: '/privacy',
    title: 'Privacy Policy',
    description: 'How Drive Kochi collects, uses and protects the details you share when you send a booking request.',
    intro:
      'Drive Kochi is a unit of AVS Rent A Car, Kochi, Kerala ("we", "us"). This policy explains what personal data we collect through this website, why, and the choices you have. It follows the Digital Personal Data Protection Act, 2023 and the Information Technology Act, 2000.',
    sections: [
      {
        heading: 'What we collect',
        body: [
          'When you send a booking request we collect:',
          [
            'your name and mobile number',
            'your email address, if you give one',
            'the car you chose, your pickup and return dates and times, and your pickup and drop-off places',
            'anything you write in the message box',
          ],
          'When you rent a car, we also see the documents the rental needs (driving licence and a government ID, for example). We check these in person; they are not uploaded through this website.',
          'We do not ask for payment details on this website, and we do not take payments online.',
        ],
      },
      {
        heading: 'Why we use it',
        body: [
          [
            'to call or message you about your request, confirm availability and the price, and arrange the handover',
            'to manage your booking and keep a record of it',
            'to meet our legal duties, for example records the law or the police may ask for',
            'to protect the website from spam and abuse',
          ],
          'We do not sell your data, and we do not use it for advertising. We only message you about your own booking unless you ask us to.',
        ],
      },
      {
        heading: 'Who we share it with',
        body: [
          'Only with the services that run this website for us, and only as far as they need it to do that:',
          [
            'website hosting (Netlify) and our server (Render)',
            'our database (Neon), where booking requests are stored',
            'an email service (Resend) that alerts our team when a new request comes in',
          ],
          'These services may store data outside India. We may also share data when the law requires it, for example with the police or a court.',
        ],
      },
      {
        heading: 'Cookies and similar storage',
        body: [
          'We do not use advertising or tracking cookies. Your browser remembers your light / dark theme choice on your own device. Staff who log in to our admin area get a login cookie. Fonts are loaded from Google Fonts, which means Google sees your IP address when the page loads.',
        ],
      },
      {
        heading: 'How long we keep it',
        body: [
          'We keep booking requests for as long as we need them to handle your booking and for our business records, and then delete them. Ask us and we will delete your request sooner, unless the law requires us to keep it.',
        ],
      },
      {
        heading: 'Keeping it safe',
        body: [
          'The website uses an encrypted connection (https), the admin area is password protected, and only our staff can see booking requests. No system is perfectly secure, but we take reasonable care to protect your data.',
        ],
      },
      {
        heading: 'Your rights',
        body: [
          'You can ask us to show you the data we hold about you, correct it, or delete it, and you can withdraw your consent at any time. You can also name someone to act for you. To do any of this, or to raise a complaint, contact us below. If you are not satisfied with our reply, you may complain to the Data Protection Board of India.',
        ],
      },
      {
        heading: 'Children',
        body: ['This website is for adults. You must be at least 18 to send a booking request, and 21 to rent a car.'],
      },
      {
        heading: 'Changes',
        body: ['We may update this policy. The date at the top shows when it last changed.'],
      },
      {
        heading: 'Contact',
        body: [`Questions about your data? ${CONTACT}`],
      },
    ],
  },

  terms: {
    path: '/terms',
    title: 'Terms & Conditions',
    description: 'The terms for using the Drive Kochi website and renting a self-drive car from us.',
    intro:
      'These terms apply when you use this website and when you rent a car from Drive Kochi, a unit of AVS Rent A Car, Kochi, Kerala. By sending a booking request you agree to them. The rental agreement you sign at pickup also applies; if it differs from these terms, the signed agreement wins.',
    sections: [
      {
        heading: 'Booking requests',
        body: [
          'Sending a booking request is free and does not reserve a car. A booking is only confirmed when we call or message you to confirm it.',
          'Prices shown on the website are starting daily rates. The final price depends on the car, the season and your trip, and we tell you the price before you confirm.',
          'Please give correct details. We may decline a request we cannot verify.',
        ],
      },
      {
        heading: 'Who can rent',
        body: [
          [
            'you must be at least 21 years old and have held a valid driving licence for at least 1 year',
            'you must show your original driving licence and a government ID (Aadhaar, passport or voter ID); we may also ask for address proof',
            'foreign visitors need a valid passport, visa, and an International Driving Permit along with their home licence',
          ],
          'Only the people named in the rental agreement may drive the car.',
        ],
      },
      {
        heading: 'Payment and security deposit',
        body: [
          'Payment is arranged when we confirm your booking; nothing is charged on this website. A refundable security deposit is taken at pickup. It is returned within 3 working days after you return the car, less any amounts you owe under these terms, such as damage, fines or extra charges.',
        ],
      },
      {
        heading: 'Using the car',
        body: [
          'While you have the car, you agree to:',
          [
            'drive safely and follow the Motor Vehicles Act and all traffic rules',
            'not drive under the influence of alcohol or drugs',
            'not use the car for racing, towing, carrying goods or passengers for money, or anything illegal',
            'not sublet the car or let anyone else drive it',
            'not smoke in the car, and return it in the condition you received it',
            'tell us straight away about any accident, breakdown, damage or theft, and file a police report when the law requires it',
          ],
        ],
      },
      {
        heading: 'Fuel, time and charges',
        body: [
          'Return the car at the agreed time and place. Late returns, fuel, cleaning, tolls, parking and any traffic fines or challans during your rental are charged to you as set out when we confirm your booking.',
        ],
      },
      {
        heading: 'Damage and responsibility',
        body: [
          'You are responsible for the car from pickup until we take it back. Damage, loss or fines caused while it is with you are your responsibility, up to the limits set out in your rental agreement and the car\'s insurance. Insurance may not cover damage caused by breaking these terms, such as drunk driving.',
        ],
      },
      {
        heading: 'Cancellations',
        body: ['See our Cancellation & Refund Policy.'],
        link: { to: '/cancellation-policy', label: 'Cancellation & Refund Policy' },
      },
      {
        heading: 'The website',
        body: [
          'We try to keep the website accurate and available, but car photos are for illustration and the actual car may differ slightly. We are not liable for losses caused by the website being unavailable or by errors on it, as far as the law allows. Do not misuse the website, for example by sending false requests or trying to break it.',
        ],
      },
      {
        heading: 'Law',
        body: ['These terms are governed by the laws of India. Courts in Kochi, Kerala have jurisdiction over any dispute.'],
      },
      {
        heading: 'Contact',
        body: [CONTACT],
      },
    ],
  },

  cancellation: {
    path: '/cancellation-policy',
    title: 'Cancellation & Refund Policy',
    description: 'How to cancel a Drive Kochi booking, and how refunds and the security deposit work.',
    intro: 'Plans change. This page explains how cancellations and refunds work at Drive Kochi.',
    sections: [
      {
        heading: 'Booking requests',
        body: [
          'A booking request sent through this website is free and does not commit you to anything. If you change your mind before we confirm, just tell us, or ignore our call. There is nothing to pay.',
        ],
      },
      {
        heading: 'Cancelling a confirmed booking',
        body: [
          `To cancel a confirmed booking, ${CONTACT.charAt(0).toLowerCase()}${CONTACT.slice(1)} Please tell us as early as you can.`,
          'Any cancellation charge depends on how close to the pickup time you cancel, and is told to you when we confirm your booking. If you paid anything in advance, we refund it after deducting that charge.',
        ],
      },
      {
        heading: 'If we cancel',
        body: [
          'If we cannot provide the car you booked, we will offer you a similar car or a full refund of anything you paid in advance.',
        ],
      },
      {
        heading: 'Returning early',
        body: ['If you return the car before the agreed time, whether any unused days are refunded is agreed with you at the time.'],
      },
      {
        heading: 'Security deposit',
        body: [
          'The security deposit is refunded within 3 working days of returning the car, after deducting any damage, fines or extra charges under our Terms & Conditions.',
        ],
      },
      {
        heading: 'How refunds are paid',
        body: [
          'Refunds go back the way you paid, or by bank transfer / UPI to your account. Your bank may take a few more days to show the money.',
        ],
      },
      {
        heading: 'Contact',
        body: [`Questions about a cancellation or refund? ${CONTACT}`],
      },
    ],
  },
}

export const LEGAL_LIST = Object.values(LEGAL_PAGES)
