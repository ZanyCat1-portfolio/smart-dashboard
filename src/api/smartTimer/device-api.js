const express = require('express');
const deviceDAL = require('../../dal/device-dal');
const Device = require('../../models/Device');
const eventBus = require('../../utils/eventBus');
const { devices } = require('../../data/devices');

// /api/devices due to proxy-server.cjs and index.js .use statements

module.exports = (io) => {
  const router = express.Router();

  // Utility: update in-mem db and emit event
  function updateDeviceInMem(device) {
    // console.log("UPDATE DEVICE IN MEM")
    // console.log("device is:", device)
    // console.log("devices before update is:", devices)
    devices[device.id] = device;
    // console.log("devices after update is:", devices)
  }

  // Utility: find device by endpoint (in-mem)
  function findDeviceByEndpoint(endpoint) {
    return Object.values(devices).find(d => d.pushSubscription && d.pushSubscription.endpoint === endpoint) || null;
  }

  // Utility: get all devices (in-mem, optionally filter)
  function getDevices({ userId, name } = {}) {
    let list = Object.values(devices);
    if (userId) list = list.filter(d => d.userId === Number(userId));
    if (name) list = list.filter(d => d.name === name);
    return list;
  }

  // --- ENDPOINTS ---

  // POST /api/devices/reactivate-or-register
  router.post('/reactivate-or-register', (req, res) => {
    console.log("this is for new devices?")
    try {
      const { userId, name, pushSubscription } = req.body;

      if (!userId || typeof userId !== 'number') {
        return res.status(400).json({ error: 'userId (number) required' });
      }
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Device name required' });
      }
      if (!pushSubscription || typeof pushSubscription !== 'object' || !pushSubscription.endpoint) {
        return res.status(400).json({ error: 'Valid pushSubscription object required' });
      }

      const existing = findDeviceByEndpoint(pushSubscription.endpoint);
      if (existing) {
        if (existing.active) {
          return res.status(409).json({ error: 'A device with this push subscription already exists and is active', device: existing });
        } else {
          const updatedDevice = deviceDAL.updateDevice(existing.id, {
            active: true,
            name,
            userId,
            pushSubscription,
          });
          updateDeviceInMem(updatedDevice);
          eventBus.emit('device:reactivated', updatedDevice);
          return res.status(200).json(updatedDevice);
        }
      }

      // Create new device if not found
      const device = deviceDAL.createDevice(req.body);
      updateDeviceInMem(device);
      eventBus.emit('device:created', device);
      return res.status(201).json(device);

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Find a device by push subscription endpoint
  router.post('/find', (req, res) => {
    try {
      const { endpoint } = req.body;
      if (!endpoint) return res.status(400).json({ error: 'Endpoint required' });
      const device = findDeviceByEndpoint(endpoint);
      if (!device) return res.status(404).json({ error: 'Device not found' });
      res.json(device);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // List all devices (optional: ?userId=123)
  router.get('/', (req, res) => {
    try {
      const { userId, name } = req.query;
      const devicesList = getDevices({ userId, name });
      res.json(devicesList);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get device by id
  router.get('/:id', (req, res) => {
    try {
      const device = devices[req.params.id];
      if (!device) return res.status(404).json({ error: 'Not found' });
      res.json(device);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update device (full PUT)
  router.put('/:id', (req, res) => {
    console.log("who ever calls this? new device?")
    try {
      const updated = deviceDAL.updateDevice(req.params.id, req.body);
      updateDeviceInMem(updated);
      eventBus.emit('device:updated', updated);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Patch device (commonly for activate/deactivate)
  router.patch('/:id', (req, res) => {
    const deviceId = req.params.id;
    const updates = { ...req.body }; // clone so we can modify

    if (typeof updates.active !== 'boolean' && !Object.keys(updates).length) {
      return res.status(400).json({ error: 'Invalid or missing fields in request body' });
    }

    try {
      let device = deviceDAL.getDeviceById(deviceId);
      if (!device) return res.status(404).json({ error: 'Device not found' });

      
      const updatedDevice = deviceDAL.updateDevice(deviceId, updates);
      updateDeviceInMem(updatedDevice);

      // devices[device.id] = device;
      console.log("device-api emitting to eventBus.emit('device:updated'")
      eventBus.emit('device:updated', updatedDevice);

      return res.json(updatedDevice);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });



  // No physical delete: do not emit device:deleted, only deactivate.

  // Optionally support delete if needed, but commented out per requirements
  /*
  router.delete('/:id', (req, res) => {
    try {
      deviceDAL.deleteDevice(req.params.id);
      delete devices[Number(req.params.id)];
      eventBus.emit('device:deleted', { id: Number(req.params.id) });
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  */

  return router;
};

module.exports.devices = devices;