const express = require('express');
const deviceDAL = require('../../dal/device-dal');
const Device = require('../../models/Device');

module.exports = (io) => {

  const router = express.Router();
  
  // Register a new device
  router.post('/', async (req, res) => {
    try {
      const device = await deviceDAL.createDevice(req.body);
      res.status(201).json(device);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // List all devices (optional: ?userId=123)
  router.get('/', async (req, res) => {
    try {
      const { userId } = req.query;
      let devices;
      if (userId) {
        devices = await deviceDAL.listDevicesByUser(userId);
      } else {
        devices = await deviceDAL.listAllDevices();
      }
      res.json(devices);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Get device by id
  router.get('/:id', async (req, res) => {
    try {
      const device = await deviceDAL.getDeviceById(req.params.id);
      if (!device) return res.status(404).json({ error: 'Not found' });
      res.json(device);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Update device
  router.put('/:id', async (req, res) => {
    try {
      const updated = await deviceDAL.updateDevice(req.params.id, req.body);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Delete device
  router.delete('/:id', async (req, res) => {
    try {
      await deviceDAL.deleteDevice(req.params.id);
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  return router;
}