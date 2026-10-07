const { getStatus, runSync } = require('../services/sheetSync');

// GET /api/admin/sheet-sync - is the Google Sheet connected, and how did
// the last sync go
function getSheetSyncStatus(req, res) {
  res.json(getStatus());
}

// POST /api/admin/sheet-sync - sync now and answer when done
async function runSheetSync(req, res, next) {
  try {
    if (!getStatus().configured) {
      return res.status(400).json({ error: 'The Google Sheet is not connected yet' });
    }
    await runSync();
    res.json(getStatus());
  } catch (err) {
    next(err);
  }
}

module.exports = { getSheetSyncStatus, runSheetSync };
