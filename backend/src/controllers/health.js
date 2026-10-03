function check(req, res) {
  res.status(200).json({ ok: true });
}

module.exports = { check };
