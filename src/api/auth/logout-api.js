// src/api/auth/logout-api.js
const express = require('express');

module.exports = () => {
  const router = express.Router();

  router.post('/', (req, res) => {
    req.session.destroy(err => {
      if (err) return res.status(500).json({ error: 'Failed to log out' });
      res.json({ success: true });
    });
  });

  return router;
};
