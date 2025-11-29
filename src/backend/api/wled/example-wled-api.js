const express = require('express');

// /api/example-wled due to proxy-server.cjs and index.js .use statements
module.exports = (io) => {

    const router = express.Router();
    const { demoState, demoTimers, emitDemoStatus, getDemoStatus } = require('../../utils/apiHelpers');

    const exampleWledTimers = {}; // Store active timers for example devices

    router.post('/:device/timer', (req, res) => {
      const { device } = req.params;
      const minutes    = parseInt(req.body.minutes, 10);
      const deviceObj  = require('../../utils/apiHelpers').getDevice(device);

      if (!deviceObj || deviceObj.type !== 'wled-controller' || !deviceObj.example) {
        return res.status(404).json({ error: 'Unknown example WLED device' });
      }
      if (isNaN(minutes) || minutes < 0) {
        return res.status(400).json({ error: 'Invalid minutes' });
      }

      // Cancel logic
      if (minutes === 0) {
        if (exampleWledTimers[device]?.timeout) clearTimeout(exampleWledTimers[device].timeout);
        delete exampleWledTimers[device];
        demoState[deviceObj.endpoint] = false;
        emitDemoStatus(deviceObj, false);
        io.emit('timer-update', { device: deviceObj.endpoint, running: false });
        return res.json({ success: true, cancelled: true });
      }

      // Mock turn on
      demoState[deviceObj.endpoint] = true;
      emitDemoStatus(deviceObj, true);

      let endTime;
      if (exampleWledTimers[device] && exampleWledTimers[device].endTime > Date.now()) {
        endTime = exampleWledTimers[device].endTime + (minutes * 60_000);
        if (exampleWledTimers[device].timeout) clearTimeout(exampleWledTimers[device].timeout);
      } else {
        endTime = Date.now() + (minutes * 60_000);
      }

      const ms = endTime - Date.now();
      const timeout = setTimeout(() => {
        demoState[deviceObj.endpoint] = false;
        emitDemoStatus(deviceObj, false);
        io.emit('timer-update', { device: deviceObj.endpoint, running: false });
        delete exampleWledTimers[device];
      }, ms);

      exampleWledTimers[device] = { endTime, timeout };

      io.emit('timer-update', { device: deviceObj.endpoint, endTime, running: true });

      res.json({ success: true, endTime });
    });

    // Device status for example WLED device
    router.get('/:device/status', (req, res) => {
      const { device } = req.params;
      const deviceObj = require('../../utils/apiHelpers').getDevice(device);

      if (!deviceObj || deviceObj.type !== 'wled-controller' || !deviceObj.example) {
        return res.status(404).json({ error: 'Unknown example WLED device' });
      }

      const data = getDemoStatus(deviceObj);
      const timer = exampleWledTimers[device];

      if (timer && timer.endTime > Date.now()) {
        data.timer = {
          running: true,
          endTime: timer.endTime,
          remainingMs: Math.max(0, timer.endTime - Date.now())
        };
      } else {
        data.timer = { running: false };
      }

      res.json(data);
    });

    // Timer status for example WLED device
    router.get('/:device/timer/status', (req, res) => {
      const timer = exampleWledTimers[req.params.device];
      const deviceObj = require('../../utils/apiHelpers').getDevice(req.params.device);

      const power = (deviceObj && timer && timer.endTime > Date.now()) ? 'on' : 'off';

      if (!timer) return res.json({ running: false, power });
      res.json({
        running: true,
        remainingMs: Math.max(0, timer.endTime - Date.now()),
        power
      });
    });

    // Generic proxy for example WLED (on/off/toggle/status)
    router.all('/:device/:action', (req, res) => {
      const { device, action } = req.params;
      const deviceObj = require('../../utils/apiHelpers').getDevice(device);

      if (!deviceObj || deviceObj.type !== 'wled-controller' || !deviceObj.example) {
        return res.status(404).json({ error: 'Unknown example WLED device or action' });
      }

      let newState = demoState[deviceObj.endpoint] || false;

      if (action === 'on') {
        newState = true;
      } else if (action === 'off') {
        newState = false;
      } else if (action === 'toggle') {
        newState = !newState;
      }

      demoState[deviceObj.endpoint] = newState;
      emitDemoStatus(deviceObj, newState);

      res.json({
        on: newState,
        success: true
      });
    });

    return router;
}
