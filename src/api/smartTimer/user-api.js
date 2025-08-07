const express = require('express');
const userDAL = require('../../dal/user-dal');
const deviceDAL = require('../../dal/device-dal');
const User = require('../../models/User');
const eventBus = require('../../utils/eventBus');
const { users } = require('../../data/users');

module.exports = (io) => {
  const router = express.Router();

  // Register a new user
  router.post('/', async (req, res) => {
    const { username, password, email } = req.body;

    if (!username || typeof username !== 'string' || !username.trim()) {
      return res.status(400).json({ error: 'username (string) required' });
    }
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'password (string) required' });
    }

    try {
      // Username/email uniqueness check
      const existingUser = Object.values(users).find(u => u.username === username);
      if (existingUser) {
        return res.status(409).json({ error: 'Username already exists', user: existingUser });
      }
      if (email) {
        const existingEmail = Object.values(users).find(u => u.email === email);
        if (existingEmail) {
          return res.status(409).json({ error: 'Email already exists', user: existingEmail });
        }
      }

      // Hash password
      const bcrypt = require('bcrypt');
      const passwordHash = await bcrypt.hash(password, 10);

      // Create in persistent DB (pass passwordHash, not password)
      const user = userDAL.createUser({ username, email, passwordHash });
      users[user.id] = user;
      console.log("added", user, "to users: ", users)
      eventBus.emit('user:created', user);

      // Optionally, you may want to return {success: true} for auth-style, or full user for admin-style
      res.status(201).json({ success: true, user });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // List all users (?active=true|false, ?username)
  router.get('/', (req, res) => {
    try {
      let safeResult = Object.values(users).map(({ passwordHash, ...u}) => u);
      if (req.query.active !== undefined) {
        const wantActive = String(req.query.active) === 'true';
        safeResult = safeResult.filter(u => !!u.active === wantActive);
      }
      if (req.query.username) {
        // Partial match (case-insensitive)
        const filter = req.query.username.toLowerCase();
        safeResult = safeResult.filter(u => (u.username || '').toLowerCase().includes(filter));
      }
      res.json(safeResult);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Find user(s) by name
  router.get('/find', (req, res) => {
    const name = req.query.name;
    if (!name) {
      return res.status(400).json({ error: 'name query parameter required' });
    }
    try {
      const filter = name.toLowerCase();
      const result = Object.values(users).filter(u => (u.username || '').toLowerCase().includes(filter));
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get user by id
  router.get('/:id', (req, res) => {
    try {
      const user = users[req.params.id];
      if (!user) return res.status(404).json({ error: 'Not found' });
      res.json(user);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get all devices for a user
  router.get('/:id/devices', (req, res) => {
    try {
      // Always use deviceDAL to get latest devices (can be in-mem if you refactor that file!)
      const devices = deviceDAL.listDevicesByUser(req.params.id);
      res.json(devices);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update user info (PATCH: username/email)
  router.patch('/:id', (req, res) => {
    try {
      const userId = req.params.id;
      const updates = req.body;

      let user = users[userId];
      if (!user) return res.status(404).json({ error: 'Not found' });

      // Do not allow username/email conflicts
      if (updates.username && updates.username !== user.username) {
        if (Object.values(users).some(u => u.username === updates.username)) {
          return res.status(409).json({ error: 'Username already exists' });
        }
      }
      if (updates.email && updates.email !== user.email) {
        if (Object.values(users).some(u => u.email === updates.email)) {
          return res.status(409).json({ error: 'Email already exists' });
        }
      }

      // Update persistent DB
      user = userDAL.updateUser(userId, updates);
      // Update in-mem
      users[userId] = user;
      eventBus.emit('user:updated', user);

      res.json(user);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Deactivate user (soft delete)
  router.patch('/:id/deactivate', (req, res) => {
    try {
      const userId = req.params.id;
      // Update persistent DB
      userDAL.deactivateUser(userId);
      // Update in-mem
      if (users[userId]) users[userId].active = false;
      eventBus.emit('user:deactivated', users[userId]);
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Reactivate user
  router.patch('/:id/activate', (req, res) => {
    try {
      const userId = req.params.id;
      userDAL.activateUser(userId);
      if (users[userId]) users[userId].active = true;
      eventBus.emit('user:reactivated', users[userId]);
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // (Optional) Hard delete user
  router.delete('/:id', (req, res) => {
    try {
      const userId = req.params.id;
      userDAL.deleteUser(userId);
      delete users[userId];
      eventBus.emit('user:deleted', { id: userId });
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Rehydrate users when this module loads (should also call from server restart)
  // (Already called at file top.)

  return router;
}

module.exports.users = users;