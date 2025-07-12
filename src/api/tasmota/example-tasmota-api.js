// endpoint as such: .../api/example-tasmota/
// sample router.get('/example/:device/status url in dev server:
// https://localhost:5173/api/example-tasmota/example/fireplaceblowerfan/status)

const express = require('express');

module.exports = (io) => {
  const router = express.Router();
  const fs = require('fs');
  const {
    DEVICES_PATH, isDemo, getDevice, emitDemoStatus,
    getDemoStatus, demoTimers, demoState
  } = require('../../utils/apiHelpers');

  // ───── Example Tasmota: Device Status Endpoints ─────

  // Get device ON/OFF status
  router.get('/example/:device/status', (req, res) => {
    const deviceObj = getDevice(req.params.device);
    if (!deviceObj || !isDemo(deviceObj)) return res.status(404).json({ error: 'Unknown demo device' });
    const state = demoState[deviceObj.endpoint] || 'off';
    res.json({ Status: { Power: state } });
  });

  // List all example Tasmota devices
  router.get('/example', (req, res) => {
    console.log("BUT AM I EVEN HAPPENING?")
    try {
      const raw = fs.readFileSync(DEVICES_PATH, 'utf-8');
      const devices = JSON.parse(raw);
      const exampleTasmota = Object.values(devices).filter(
        d => d.type === 'tasmota' && d.example
      );
      res.json(exampleTasmota);
    } catch (err) {
      console.error('[GET /example] Failed to load devices:', err);
      res.status(500).json({ error: 'Failed to load devices' });
    }
  });

  // ───── Example Tasmota: Timer Logic ─────

  // Set, add to, or cancel a timer
  router.post('/example/:device/timer', (req, res) => {
    console.log("what is demoTimers in example-tasmota-api.js: ", demoTimers)
      const { device } = req.params;
      const minutes = parseInt(req.body.minutes, 10);
      const deviceObj = getDevice(device);
      if (!deviceObj || !isDemo(deviceObj)) return res.status(404).json({ error: 'Unknown demo device' });

      if (isNaN(minutes) || minutes < 0) {
          return res.status(400).json({ error: 'Invalid minutes' });
      }

      // Cancel logic
      if (minutes === 0) {
        console.log("did example-tasmota-api.js just cancel?", Date.now())
          if (demoTimers[device]?.timeout) clearTimeout(demoTimers[device].timeout);
          delete demoTimers[device];
          emitDemoStatus(deviceObj, 'off');
          io.emit('device-status', { endpoint: deviceObj.endpoint, state: 'off' });  // <--- emit device-status
          io.emit('timer-update', { device: deviceObj.endpoint, running: false, endTime: null });
          return res.json({ success: true, cancelled: true });
      }

      // Start new or add time
      let endTime;
      if (demoTimers[device] && demoTimers[device].endTime > Date.now()) {
          endTime = demoTimers[device].endTime + minutes * 60_000;
          if (demoTimers[device].timeout) clearTimeout(demoTimers[device].timeout);
      } else {
          endTime = Date.now() + minutes * 60_000;
      }

      emitDemoStatus(deviceObj, 'on');
      io.emit('device-status', { endpoint: deviceObj.endpoint, state: 'on' }); // <--- emit device-status ON

      const ms = endTime - Date.now();
      const timeout = setTimeout(() => {
          emitDemoStatus(deviceObj, 'off');
          io.emit('device-status', { endpoint: deviceObj.endpoint, state: 'off' });
          delete demoTimers[device];
          io.emit('timer-update', { device: deviceObj.endpoint, running: false, endTime: null }); // <--- FIXED
      }, ms);


      demoTimers[device] = { endTime, timeout };

      io.emit('timer-update', { device: deviceObj.endpoint, running: true, endTime });
      res.json({ success: true, endTime });
  });

  // Timer status: remaining time and power state
  router.get('/example/:device/timer/status', (req, res) => {
    const timer = demoTimers[req.params.device];
    const deviceObj = getDevice(req.params.device);
    const power =
      (deviceObj && timer && timer.endTime > Date.now()) ? 'on'
      : (deviceObj && demoTimers[req.params.device]) ? 'off'
      : 'off';
    if (!timer) return res.json({ running: false, power });
    res.json({ running: true, remainingMs: Math.max(0, timer.endTime - Date.now()), power });
  });

  // ───── Example Tasmota: Generic ON/OFF/TOGGLE/STATUS ─────

  const DEMO_ACTIONS = ['on', 'off', 'toggle', 'status'];
  router.all('/example/:device/:action', (req, res) => {
      const { device, action } = req.params;
      const deviceObj = getDevice(device);
      if (!deviceObj || !isDemo(deviceObj) || !DEMO_ACTIONS.includes(action.toLowerCase())) {
          return res.status(404).json({ error: 'Unknown demo device or action' });
      }

      // Status
      if (action === 'status') {
          return res.json(getDemoStatus(deviceObj));
      }

      // Toggle/on/off logic
      let curr = demoState[deviceObj.endpoint] || 'off';
      let newState;
      if (action === 'toggle') {
          newState = curr === 'on' ? 'off' : 'on';
      } else if (action === 'on') {
          newState = 'on';
      } else if (action === 'off') {
          newState = 'off';
      }
      emitDemoStatus(deviceObj, newState);
      io.emit('device-status', { endpoint: deviceObj.endpoint, state: newState }); // <--- emit device-status ON/OFF

      return res.json({ success: true, state: newState });
  });


  return router;
};