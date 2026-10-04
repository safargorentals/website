function notFound(req, res) {
  // The URL is not echoed back: attacker-chosen text never ends up in responses
  res.status(404).json({ error: 'Not found' });
}

module.exports = notFound;
