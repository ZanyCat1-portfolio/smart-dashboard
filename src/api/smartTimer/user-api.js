const express = require('express');
const userDAL = require('../../dal/user-dal');
const deviceDAL = require('../../dal/device-dal');
const User = require('../../models/User');

// /api/users due to proxy-server.cjs and index.js .use statements
module.exports = (io) => {

  const router = express.Router();
  
  // Register a new user
  router.post('/', (req, res) => {
    const { username, email } = req.body;

    // Basic validation
    if (!username || typeof username !== 'string' || !username.trim()) {
      return res.status(400).json({ error: 'username (string) required' });
    }
    // (optional) Validate email format here if you want

    // Uniqueness enforcement
    const existingUser = userDAL.getUserByUsername(username);
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists', user: existingUser });
    }
    if (email) {
      const existingEmail = userDAL.getUserByEmail(email);
      if (existingEmail) {
        return res.status(409).json({ error: 'Email already exists', user: existingEmail });
      }
    }

    try {
      const user = userDAL.createUser({ username, email });
      res.status(201).json(user);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // List all users (optional: ?active=true|false)
  router.get('/', (req, res) => {
    try {
      let filter = {};
      if (typeof req.query.active !== 'undefined') {
        filter.active = req.query.active === 'true';
      }
      const users = userDAL.listUsers(filter);
      res.json(users);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Get user by id
  router.get('/:id', (req, res) => {
    try {
      const user = userDAL.getUserById(req.params.id);
      if (!user) return res.status(404).json({ error: 'Not found' });
      res.json(user);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get all devices for a user
  router.get('/:id/devices', (req, res) => {
    try {
      const devices = deviceDAL.listDevicesByUser(req.params.id);
      res.json(devices);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Update user info (PATCH: username/email)
  router.patch('/:id', (req, res) => {
    try {
      const updated = userDAL.updateUser(req.params.id, req.body);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Deactivate user (soft delete)
  router.patch('/:id/deactivate', (req, res) => {
    try {
      userDAL.deactivateUser(req.params.id);
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Reactivate user
  router.patch('/:id/activate', (req, res) => {
    try {
      userDAL.activateUser(req.params.id);
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // (Optional) Hard delete user
  router.delete('/:id', (req, res) => {
    try {
      userDAL.deleteUser(req.params.id);
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  return router;
}
