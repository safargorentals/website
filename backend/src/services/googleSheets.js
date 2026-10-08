const jwt = require('jsonwebtoken');
const env = require('../config/env');

// A tiny Google Sheets client for one spreadsheet, logged in as a Google
// "service account" (a robot Google user). The sheet must be shared with
// the service account's email as an Editor.
//
// Configured by two environment variables (see .env.example):
//   GOOGLE_SHEET_ID              the id in the sheet's link
//   GOOGLE_SERVICE_ACCOUNT_JSON  the service account's key file (JSON, or
//                                the same JSON base64-encoded)

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://sheets.googleapis.com/v4/spreadsheets';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const TIMEOUT_MS = 15000;

// Reads the key once. Returns null when the sheet is not configured.
function loadCredentials() {
  const raw = env.googleServiceAccountJson;
  if (!env.googleSheetId || !raw) return null;
  const text = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  const key = JSON.parse(text);
  if (!key.client_email || !key.private_key) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON has no client_email / private_key');
  }
  // Keys pasted into a single-line variable often carry literal "\n"
  return { email: key.client_email, privateKey: key.private_key.replace(/\\n/g, '\n') };
}

let credentials;
let cachedToken = null; // { value, expiresAt }

function getCredentials() {
  if (credentials === undefined) credentials = loadCredentials();
  return credentials;
}

function isConfigured() {
  try {
    return !!getCredentials();
  } catch {
    return false;
  }
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, { ...options, signal: AbortSignal.timeout(TIMEOUT_MS) });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const message = body.error?.message || body.error_description || body.error || `HTTP ${res.status}`;
    const err = new Error(`Google Sheets: ${message}`);
    err.status = res.status;
    throw err;
  }
  return body;
}

// An access token, reused until a minute before it expires
async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) return cachedToken.value;
  const { email, privateKey } = getCredentials();
  const assertion = jwt.sign({ scope: SCOPE }, privateKey, {
    algorithm: 'RS256',
    issuer: email,
    audience: TOKEN_URL,
    expiresIn: 3600,
  });
  const body = await fetchJson(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  cachedToken = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return cachedToken.value;
}

async function call(path, { method = 'GET', body } = {}) {
  const token = await getAccessToken();
  return fetchJson(`${API}/${env.googleSheetId}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const quote = (title) => `'${title.replace(/'/g, "''")}'`;

// Tab titles -> numeric sheet ids, plus the protected ranges already set
async function getSpreadsheet() {
  const data = await call(
    '?fields=properties.title,sheets(properties(sheetId,title),protectedRanges(description),bandedRanges(bandedRangeId))'
  );
  return data;
}

// Every value on each tab, as displayed (strings)
async function readTabs(titles) {
  const params = new URLSearchParams({ valueRenderOption: 'FORMATTED_VALUE' });
  for (const t of titles) params.append('ranges', quote(t));
  const data = await call(`/values:batchGet?${params}`);
  return (data.valueRanges || []).map((r) => r.values || []);
}

// Replace a whole tab's values. RAW keeps "+91 98765 43210" and dates as
// plain text instead of letting Sheets turn them into numbers or formulas.
async function writeTab(title, rows) {
  await call(`/values/${encodeURIComponent(quote(title))}:clear`, { method: 'POST', body: {} });
  if (rows.length === 0) return;
  await call(`/values/${encodeURIComponent(quote(title))}?valueInputOption=RAW`, {
    method: 'PUT',
    body: { values: rows },
  });
}

async function batchUpdate(requests) {
  if (requests.length === 0) return;
  await call(':batchUpdate', { method: 'POST', body: { requests } });
}

function sheetUrl() {
  return env.googleSheetId ? `https://docs.google.com/spreadsheets/d/${env.googleSheetId}/edit` : null;
}

function serviceAccountEmail() {
  try {
    return getCredentials()?.email || null;
  } catch {
    return null;
  }
}

module.exports = {
  isConfigured,
  getSpreadsheet,
  readTabs,
  writeTab,
  batchUpdate,
  sheetUrl,
  serviceAccountEmail,
};
