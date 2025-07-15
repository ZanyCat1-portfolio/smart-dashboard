const express = require('express');
const deviceDAL = require('../../dal/device-dal');
const Device = require('../../models/Device');

// /api/devices due to proxy-server.cjs and index.js .use statements
module.exports = (io) => {

  const router = express.Router();
  
  // Register a new device
  router.post('/', (req, res) => {
    const { userId, name, pushSubscription } = req.body;

    // Basic validation
    if (!userId || typeof userId !== 'number') {
      return res.status(400).json({ error: 'userId (number) required' });
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Device name required' });
    }
    if (pushSubscription && typeof pushSubscription !== 'object') {
      return res.status(400).json({ error: 'pushSubscription, if provided, must be an object' });
    }

    // Enforce uniqueness for pushSubscription.endpoint
    if (pushSubscription && pushSubscription.endpoint) {
      const existing = deviceDAL.findDeviceByEndpoint(pushSubscription.endpoint);
      if (existing) {
        return res.status(409).json({ error: 'A device with this push subscription already exists', device: existing });
      }
    }

    try {
      const device = deviceDAL.createDevice(req.body);
      res.status(201).json(device);
    } catch (err) {
      // Optional: check if error is foreign key violation, duplicate, etc
      res.status(500).json({ error: err.message });
    }
  });

  // Find a device by push subscription endpoint
  router.post('/find', (req, res) => {
    try {
      const { endpoint } = req.body;
      if (!endpoint) return res.status(400).json({ error: 'Endpoint required' });
      const device = deviceDAL.findDeviceByEndpoint(endpoint);
      if (!device) return res.status(404).json({ error: 'Device not found' });
      res.json(device);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // List all devices (optional: ?userId=123)
  router.get('/', (req, res) => {
    try {
      const { userId } = req.query;
      let devices;
      if (userId) {
        devices = deviceDAL.listDevicesByUser(userId);
      } else {
        devices = deviceDAL.listAllDevices();
      }
      res.json(devices);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Get device by id
  router.get('/:id', (req, res) => {
    try {
      const device = deviceDAL.getDeviceById(req.params.id);
      if (!device) return res.status(404).json({ error: 'Not found' });
      res.json(device);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Update device
  router.put('/:id', (req, res) => {
    try {
      const updated = deviceDAL.updateDevice(req.params.id, req.body);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Delete device
  router.delete('/:id', (req, res) => {
    try {
      deviceDAL.deleteDevice(req.params.id);
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  return router;
}
