const jwt = require('jsonwebtoken');
const env = require('../config/env');

// Checks the proof a customer's browser gets from Firebase after entering
// the SMS code (a Firebase ID token), so an enquiry can only be saved for a
// number that was really verified. Google signs these tokens; its public
// certificates are fetched and cached for as long as Google says.
//
// FIREBASE_PROJECT_ID turns the check on (see .env.example).

const CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
// A verified number stays good for a day (several enquiries, one SMS)
const MAX_AGE_SECONDS = 24 * 60 * 60;

let certs = null; // { pems: { kid: pem }, expiresAt }

async function getCerts() {
  if (certs && certs.expiresAt > Date.now()) return certs.pems;
  const res = await fetch(CERTS_URL, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Could not fetch Google certificates (HTTP ${res.status})`);
  const maxAge = Number((res.headers.get('cache-control') || '').match(/max-age=(\d+)/)?.[1]) || 3600;
  certs = { pems: await res.json(), expiresAt: Date.now() + maxAge * 1000 };
  return certs.pems;
}

class PhoneTokenError extends Error {}

function isEnabled() {
  return !!env.firebaseProjectId;
}

// Returns the verified number ("+919876543210") or throws PhoneTokenError
async function verifyPhoneToken(token) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 4096) {
    throw new PhoneTokenError('Please verify your mobile number with the SMS code');
  }
  const decoded = jwt.decode(token, { complete: true });
  const kid = decoded?.header?.kid;
  const pem = kid && (await getCerts())[kid];
  if (!pem) throw new PhoneTokenError('Your number check has expired. Please verify it again');

  let claims;
  try {
    claims = jwt.verify(token, pem, {
      algorithms: ['RS256'],
      audience: env.firebaseProjectId,
      issuer: `https://securetoken.google.com/${env.firebaseProjectId}`,
    });
  } catch {
    throw new PhoneTokenError('Your number check has expired. Please verify it again');
  }
  const now = Math.floor(Date.now() / 1000);
  if (!claims.sub || !claims.phone_number || !(claims.auth_time <= now) || now - claims.auth_time > MAX_AGE_SECONDS) {
    throw new PhoneTokenError('Your number check has expired. Please verify it again');
  }
  return claims.phone_number;
}

// "+91 98765 43210" vs "+919876543210": same last 10 digits
function samePhone(a, b) {
  const last10 = (v) => String(v).replace(/\D/g, '').slice(-10);
  return last10(a).length === 10 && last10(a) === last10(b);
}

module.exports = { isEnabled, verifyPhoneToken, samePhone, PhoneTokenError };
