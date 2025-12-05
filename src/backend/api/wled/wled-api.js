const express = require('express');

// Global reference to WLED client manager (set by proxy-server.cjs)
let wledClientManager;

// Set the WLED client manager reference
function setWledClientManager(manager) {
  wledClientManager = manager;
}

// /api/wled due to proxy-server.cjs and index.js .use statements
module.exports = (io, deviceStates) => {

    const router = express.Router();
    const { DEVICES_PATH, resolveWledIp } = require('../../utils/apiHelpers');

    const wledTimers = {}; // Store active timers per device

    router.post('/:device/timer', async (req, res) => {
      const { device } = req.params;
      const minutes    = parseInt(req.body.minutes, 10);
      const deviceObj  = require('../../utils/apiHelpers').getDevice(device);

      if (!deviceObj || deviceObj.type !== 'wled-controller') {
        return res.status(404).json({ error: 'Unknown WLED device' });
      }
      if (isNaN(minutes) || minutes < 0) {
        return res.status(400).json({ error: 'Invalid minutes' });
      }

      try {
        // Resolve the IP address
        const ip = await resolveWledIp(deviceObj.mdnsName);
        const baseUrl = `http://${ip}`;

        // Cancel logic
        if (minutes === 0) {
          if (wledTimers[device]?.timeout) clearTimeout(wledTimers[device].timeout);
          delete wledTimers[device];

          // Turn off the device
          await fetch(`${baseUrl}/json/state`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ on: false })
          });
          io.emit('timer-update', { device: deviceObj.endpoint, running: false });
          io.emit('device-status', { endpoint: deviceObj.endpoint, state: 'off' }); // Immediate update on cancel
          return res.json({ success: true, cancelled: true });
        }

        // Start timer
        await fetch(`${baseUrl}/json/state`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ on: true })
        });

        let endTime;
        if (wledTimers[device] && wledTimers[device].endTime > Date.now()) {
          endTime = wledTimers[device].endTime + (minutes * 60_000);
          if (wledTimers[device].timeout) clearTimeout(wledTimers[device].timeout);
        } else {
          endTime = Date.now() + (minutes * 60_000);
        }

        const ms = endTime - Date.now();
        const timeout = setTimeout(async () => {
          try {
            const currentIp = await resolveWledIp(deviceObj.mdnsName);
            await fetch(`http://${currentIp}/json/state`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ on: false })
            });
            io.emit('timer-update', { device: deviceObj.endpoint, running: false });
            io.emit('device-status', { endpoint: deviceObj.endpoint, state: 'off' }); // Immediate update on expiry
          } catch (error) {
            console.error('[WLED Timer Expiry Error]', error.message);
          }
          delete wledTimers[device];
        }, ms);

        wledTimers[device] = { endTime, timeout };

        io.emit('timer-update', { device: deviceObj.endpoint, endTime, running: true });
        io.emit('device-status', { endpoint: deviceObj.endpoint, state: 'on' }); // Immediate update
        res.status(200).json({ success: true, endTime });
      } catch (error) {
        console.error('[WLED Timer] Error:', error.message);
        res.status(500).json({ error: 'Timer start failed' });
      }
    });

    // Device status for real WLED device
    router.get('/:device/status', async (req, res) => {
      const { device } = req.params;
      const deviceObj = require('../../utils/apiHelpers').getDevice(device);

      if (!deviceObj || deviceObj.type !== 'wled-controller') {
        return res.status(404).json({ error: 'Unknown WLED device' });
      }

      try {
        // Resolve IP
        const ip = await resolveWledIp(deviceObj.mdnsName);

        // Check if WebSocket manager has a live state (priority over HTTP fetch)
        let onState = null;
        let lastUpdatedFromWS = false;
        const deviceId = deviceObj.endpoint; // Assuming deviceId in manager is endpoint
        if (wledClientManager && wledClientManager.connectedDevices.has(deviceId)) {
          const deviceInfo = wledClientManager.connectedDevices.get(deviceId);
          if (deviceInfo.lastState) {
            onState = deviceInfo.lastState === 'on';
            lastUpdatedFromWS = true;
          }
        }

        let state;
        if (lastUpdatedFromWS) {
          // Use WebSocket-updated state, skip HTTP fetch to avoid stale data
          state = { on: onState };
        } else {
          // Fallback to HTTP fetch if WebSocket not providing live state
          const response = await fetch(`http://${ip}/json/state`);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          state = await response.json();
          onState = state.on ? 'on' : 'off';
        }

        // Add timer info
        const timer = wledTimers[device];
        if (timer && timer.endTime > Date.now()) {
          state.timer = {
            running: true,
            endTime: timer.endTime,
            remainingMs: Math.max(0, timer.endTime - Date.now())
          };
        } else {
          state.timer = { running: false };
        }

        // Include resolved IP for frontend Web UI button (only add if not added)
        if (!lastUpdatedFromWS || !state.resolved_ip) {
          state.resolved_ip = ip;
        }

        // Update cache with current state
        const finalOnState = onState !== null ? (onState ? 'on' : 'off') : undefined;
        if (finalOnState) {
          deviceStates[deviceObj.endpoint] = { state: finalOnState, lastUpdated: Date.now() };
        }

        res.json(state);
      } catch (error) {
        console.error('[WLED Status] Error:', error.message);

        // Return cached state if available
        const cachedState = deviceStates[deviceObj.endpoint];
        if (cachedState) {
          const timer = wledTimers[device];
          const response = {
            on: cachedState.state === 'on',
            timer: timer && timer.endTime > Date.now()
              ? {
                  running: true,
                  endTime: timer.endTime,
                  remainingMs: Math.max(0, timer.endTime - Date.now())
                }
              : { running: false }
          };
          return res.json(response);
        }

        res.status(500).json({ error: 'Failed to get status' });
      }
    });

    // Timer status for WLED device
    router.get('/:device/timer/status', (req, res) => {
      const timer = wledTimers[req.params.device];
      const deviceObj = require('../../utils/apiHelpers').getDevice(req.params.device);

      const power = timer && timer.endTime > Date.now() ? 'on' : 'off';

      if (!timer) return res.json({ running: false, power });
      res.json({
        running: true,
        remainingMs: Math.max(0, timer.endTime - Date.now()),
        power
      });
    });

    // Generic proxy for WLED JSON API (on/off/toggle/status)
    router.all('/:device/:action', async (req, res) => {
      const { device, action } = req.params;
      const deviceObj = require('../../utils/apiHelpers').getDevice(device);

      if (!deviceObj || deviceObj.type !== 'wled-controller') {
        return res.status(404).json({ error: 'Unknown WLED device or action' });
      }

      try {
        const ip = await resolveWledIp(deviceObj.mdnsName);

        let body = null;
        let method = 'GET';

        if (action === 'on') {
          method = 'POST';
          body = { on: true };
        } else if (action === 'off') {
          method = 'POST';
          body = { on: false };
        } else if (action === 'toggle') {
          method = 'POST';
          body = { on: 't' }; // WLED toggle
        } else if (action === 'status') {
          // Status is handled above
          method = 'GET';
        }

        const response = await fetch(`http://${ip}/json/state`, {
          method,
          headers: body ? { 'Content-Type': 'application/json' } : undefined,
          body: body ? JSON.stringify(body) : undefined
        });

        const data = await response.json();

        res.status(response.status).json(data);
      } catch (error) {
        console.error('[WLED Proxy]', error.message);
        res.status(500).json({ error: 'Proxy failed' });
      }
    });

    return router;
}

module.exports.setWledClientManager = setWledClientManager;
