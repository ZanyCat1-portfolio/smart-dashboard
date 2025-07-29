// src/api/auth/session-api.js
// /api/auth/session
const express = require('express');

module.exports = () => {
  const router = express.Router();

  router.get('/', (req, res) => {
    console.log("/session req.session is: ", req.session)
    console.log("/session req.session.user is: ", !!req.session.user)
    if (req.session.user) {
      res.json({ user: req.session.user });
    } else {
      console.log(req.session)
      res.status(401).json({ error: 'Not logged in' });
    }
  });

  return router;
};
