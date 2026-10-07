const { scheduleSync } = require('../services/sheetSync');

// After a request that changed data (any successful admin change, or a new
// enquiry), sync the Google Sheet a few seconds later. Reads, logins and the
// sheet sync's own routes change nothing, so they are skipped.
const SKIP = /^\/api\/admin\/(login|logout|me|sheet-sync|uploads)\b/;

function sheetSyncTrigger(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  const path = req.originalUrl.split('?')[0];
  if (SKIP.test(path)) return next();
  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) scheduleSync();
  });
  next();
}

module.exports = sheetSyncTrigger;
