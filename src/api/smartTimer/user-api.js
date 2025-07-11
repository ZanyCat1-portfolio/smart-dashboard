const express = require('express');
const userDAL = require('../../dal/user-dal');
const User = require('../../models/User');

module.exports = (io) => {

  const router = express.Router();
  
  // Register a new user
  router.post('/', async (req, res) => {
    try {
      const user = await userDAL.createUser(req.body);
      res.status(201).json(user);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // List all users (optional: ?active=true|false)
  router.get('/', async (req, res) => {
    try {
      let filter = {};
      if (typeof req.query.active !== 'undefined') {
        filter.active = req.query.active === 'true';
      }
      const users = await userDAL.listUsers(filter);
      res.json(users);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Get user by id
  router.get('/:id', async (req, res) => {
    try {
      const user = await userDAL.getUserById(req.params.id);
      if (!user) return res.status(404).json({ error: 'Not found' });
      res.json(user);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Update user info (PATCH: username/email)
  router.patch('/:id', async (req, res) => {
    try {
      const updated = await userDAL.updateUser(req.params.id, req.body);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Deactivate user (soft delete)
  router.patch('/:id/deactivate', async (req, res) => {
    try {
      await userDAL.deactivateUser(req.params.id);
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Reactivate user
  router.patch('/:id/activate', async (req, res) => {
    try {
      await userDAL.activateUser(req.params.id);
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // (Optional) Hard delete user
  router.delete('/:id', async (req, res) => {
    try {
      await userDAL.deleteUser(req.params.id);
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  return router;
}