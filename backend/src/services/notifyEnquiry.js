const env = require('../config/env');

const RESEND_URL = 'https://api.resend.com/emails';
const TIMEOUT_MS = 8000; // 8 seconds

// Strip control characters and line breaks so a name can never break the
// Subject line into extra lines (header injection), then collapse spaces.
function cleanForSubject(value) {
  return String(value ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function line(label, value) {
  const text = value == null || value === '' ? '-' : String(value);
  return `${label}: ${text}`;
}

// Plain-text body on purpose: with no HTML there is nothing to escape,
// so customer text can never become markup or break out of the message.
// Customer values appear ONLY here - never in to/from/subject/headers.
function buildTextBody(e) {
  const base = (env.adminUrl || '').replace(/\/+$/, '');
  const adminLink = base ? `${base}/admin/enquiries` : '(admin link not configured)';
  return [
    'A new enquiry was submitted on SafarGo.',
    '',
    line('Name', e.name),
    line('Phone', e.phone),
    line('Email', e.email),
    line('Car', e.carName ?? (e.carId != null ? `Car #${e.carId}` : null)),
    line('Pickup', e.pickupLocation),
    line('Drop-off', e.dropoffLocation),
    line('Start date', e.startDate),
    line('End date', e.endDate),
    line('Pickup time', e.pickupTime),
    line('Drop-off time', e.dropoffTime),
    line('Message', e.message),
    '',
    'View it in the admin panel:',
    adminLink,
  ].join('\n');
}

// Tell the site owner about a saved enquiry. Fire-and-forget by design:
// the controller calls this WITHOUT await, and every failure path below
// only logs one short line (no API key, no customer details), so email
// problems can never fail or delay the customer's enquiry.
async function notifyNewEnquiry(enquiry) {
  try {
    if (!env.resendApiKey || !env.notifyEmailTo || !env.notifyEmailFrom) {
      console.log(
        'Enquiry email skipped: RESEND_API_KEY, NOTIFY_EMAIL_TO or NOTIFY_EMAIL_FROM is not set.'
      );
      return;
    }

    const subject = `New enquiry from ${cleanForSubject(enquiry.name)}`.slice(0, 100);

    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.notifyEmailFrom,
        to: [env.notifyEmailTo],
        subject,
        text: buildTextBody(enquiry),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      console.error(`Enquiry email failed: the email service answered ${res.status}.`);
    }
  } catch (err) {
    // Network error, DNS failure, timeout... - short line, nothing sensitive
    const reason = err && err.name === 'TimeoutError' ? 'request timed out' : 'could not reach the email service';
    console.error(`Enquiry email failed: ${reason}.`);
  }
}

module.exports = { notifyNewEnquiry };
