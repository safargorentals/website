// SMS code (OTP) check of the customer's mobile number, with Firebase
// Authentication, before an enquiry is sent. The backend checks the proof
// (an ID token) again, so the step can't be skipped.
//
// The config below is public by design: it ships in every page and only
// identifies the Firebase project. Phone sign-in, the allowed domains and
// the allowed SMS regions are set in the Firebase console.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyB-bJlkFKDFwgvF4FYrXjN7GM5L99udaP8',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'drivekochi-a43aa.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'drivekochi-a43aa',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:686954550218:web:39e66025541d36838db533',
}

// Off when VITE_PHONE_OTP=off (e.g. while the backend has no FIREBASE_PROJECT_ID)
export const PHONE_OTP_ENABLED = import.meta.env.VITE_PHONE_OTP !== 'off'

let authPromise = null

// Firebase is loaded only when a customer actually sends an enquiry, so the
// home page stays light
function getAuthModule() {
  if (!authPromise) {
    authPromise = Promise.all([import('firebase/app'), import('firebase/auth')]).then(([appMod, authMod]) => {
      const app = appMod.initializeApp(firebaseConfig)
      const auth = authMod.getAuth(app)
      auth.useDeviceLanguage()
      // Only for this browser tab: a shared phone or laptop forgets it
      authMod.setPersistence(auth, authMod.browserSessionPersistence)
      // Local development only (never in the built site): automated tests
      // with Firebase's test numbers skip the reCAPTCHA puzzle
      if (import.meta.env.DEV && window.__otpTestMode) auth.settings.appVerificationDisabledForTesting = true
      return { auth, authMod }
    })
  }
  return authPromise
}

const e164 = (digits) => `+91${digits}`

// Already verified this number in this tab? Then a fresh token, no SMS.
export async function tokenIfVerified(digits) {
  const { auth } = await getAuthModule()
  await auth.authStateReady()
  const user = auth.currentUser
  if (user && user.phoneNumber === e164(digits)) return user.getIdToken(true)
  return null
}

let verifier = null

// Sends the SMS. containerId: an element for Google's invisible reCAPTCHA.
// Returns a confirmation, to pass to confirmCode().
export async function sendCode(digits, containerId) {
  const { auth, authMod } = await getAuthModule()
  if (verifier) verifier.clear()
  verifier = new authMod.RecaptchaVerifier(auth, containerId, { size: 'invisible' })
  try {
    return await authMod.signInWithPhoneNumber(auth, e164(digits), verifier)
  } catch (err) {
    verifier.clear()
    verifier = null
    throw err
  }
}

// Checks the 6-digit code. Returns the ID token the backend verifies.
export async function confirmCode(confirmation, code) {
  const result = await confirmation.confirm(code)
  return result.user.getIdToken()
}

// Firebase itself not ready (billing, phone sign-in, domains): not the
// customer's fault. The form then sends without a code; the backend accepts
// that only while it isn't requiring codes (no FIREBASE_PROJECT_ID), so
// bookings keep working while Firebase is being set up.
export function isSetupError(err) {
  // Firebase sometimes only puts the server's reason in the message
  // (e.g. BILLING_NOT_ENABLED: real SMS needs the Blaze plan)
  const text = `${err?.code || ''} ${err?.message || ''}`.toLowerCase()
  return /operation-not-allowed|billing|unauthorized-domain|invalid-api-key|app-not-authorized|admin-restricted/.test(text)
}

// Firebase error codes -> what the customer should do
export function otpErrorMessage(err) {
  const code = err?.code || ''
  if (code.includes('invalid-verification-code')) return 'That code is not right. Check the SMS and try again.'
  if (code.includes('code-expired')) return 'This code has expired. Tap "Resend code" for a new one.'
  if (code.includes('too-many-requests')) return 'Too many attempts. Please wait a while, or call us to book.'
  if (code.includes('invalid-phone-number')) return 'This mobile number does not look right.'
  if (code.includes('quota-exceeded')) return "We can't send codes right now. Please call us to book."
  if (code.includes('captcha') || code.includes('network-request-failed')) {
    return 'Could not check your device. Check your connection and try again.'
  }
  if (code.includes('operation-not-allowed') || code.includes('unauthorized-domain') || code.includes('billing')) {
    return 'Phone check is not set up yet. Please call us to book.'
  }
  return 'Something went wrong sending the code. Please try again.'
}
