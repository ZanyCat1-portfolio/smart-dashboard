// src/api/auth/login-api.js
const express = require('express');
const bcrypt = require('bcrypt');
const { users } = require('../../data/users');

module.exports = () => {
  const router = express.Router();

  router.post('/', async (req, res) => {
    const { username, password } = req.body;

    const user = Object.values(users).find(u => u.username === username);

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
        req.session.user = user;
    // req.session.user = { id: user.id, username: user.username };
    res.json({ success: true, user: req.session.user });
  });

  return router;
};
