const { ipKeyGenerator } = require('express-rate-limit');

// Two ways to identify who is calling, used by every rate limiter:
//
// clientKey     - the visitor's IP. req.ip, worked out by Express from
//                 X-Forwarded-For with 'trust proxy' (Netlify + Render), so
//                 it is the real visitor behind the Netlify proxy. Someone
//                 calling the Render URL directly can fake it, which is why
//                 there is also:
// connectionKey - the address that actually connected to Render: the last
//                 X-Forwarded-For entry, written by Render itself and
//                 impossible to fake. Behind Netlify it is a Netlify edge
//                 server shared by many visitors, so limits on it are high
//                 and only stop one source from flooding the API.
//
// ipKeyGenerator groups IPv6 addresses by /56 network, so one machine cannot
// dodge a limit by rotating through its IPv6 addresses.

function connectionIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return forwarded[forwarded.length - 1] || req.socket.remoteAddress || 'unknown';
}

const clientKey = (req) => `client:${ipKeyGenerator(req.ip || 'unknown')}`;
const connectionKey = (req) => `conn:${ipKeyGenerator(connectionIp(req))}`;

module.exports = { clientKey, connectionKey };
