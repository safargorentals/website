// Express only recognises a function as an error handler if it
// has exactly 4 parameters, so keep the "next" parameter.
function errorHandler(err, req, res, next) {
  // Broken JSON sent by the client (from express.json)
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  // Body bigger than the 10 KB limit (from express.json)
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body too large' });
  }

  const status = err.status || 500;
  // For anything unexpected, only a generic message reaches the client -
  // never a stack trace or internal details.
  const message = status === 500 ? 'Internal server error' : err.message;
  console.error(err);
  res.status(status).json({ error: message });
}

module.exports = errorHandler;
