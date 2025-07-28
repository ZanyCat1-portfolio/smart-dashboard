// src/api/auth/register-api.js
const express = require('express');
const bcrypt = require('bcrypt');
const userDAL = require('../../dal/user-dal');
const registerDAL = require('../../dal/register-dal');
const { users } = require('../../data/users');

module.exports = () => {
  const router = express.Router();

  router.post('/', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const exists = Object.values(users).find(u => u.username === username);
    if (exists) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    try {
      const passwordHash = await bcrypt.hash(password, 10);
      const createdAt = new Date().toISOString();

      const userId = registerDAL.insertUser({ username, passwordHash, createdAt });
      const user = userDAL.getUserById(userId);
      users[user.id] = user;

      res.status(201).json({ success: true });
    } catch (err) {
      console.error('[Register Error]', err);
      res.status(500).json({ error: 'Failed to register user' });
    }
  });

  return router;
};
