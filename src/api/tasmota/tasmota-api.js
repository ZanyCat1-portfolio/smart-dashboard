const express = require('express');

module.exports = (io) => {

    const router = express.Router();
    const fs       = require('fs');
    
    const { DEVICES_PATH, isDemo, getDevice, emitDemoStatus, getDemoStatus } = require('../../utils/apiHelpers')
    
    const commandMap = {
      toggle: 'POWER TOGGLE',
      on:     'POWER ON',
      off:    'POWER OFF',
      status: 'STATUS 0',
    };
    
    const tasmotaTimers = {};
    
    router.post('/:device/timer', async (req, res) => {
      const { device } = req.params;
      const minutes    = parseInt(req.body.minutes, 10);
      const deviceObj  = getDevice(device);
      if (!deviceObj || isDemo(deviceObj)) return res.status(404).json({ error: 'Unknown device' });
      if (isNaN(minutes) || minutes < 0) return res.status(400).json({ error: 'Invalid minutes' });
    
      const commandUrl = cmd => `http://${deviceObj.ip}/cm?cmnd=${encodeURIComponent(cmd)}`;
    
      // Cancel logic
      if (minutes === 0) {
        if (tasmotaTimers[device]?.timeout) clearTimeout(tasmotaTimers[device].timeout);
        delete tasmotaTimers[device];
        await fetch(commandUrl('POWER OFF')).catch(error => console.error(error));
        io.emit('device-status', { endpoint: deviceObj.endpoint, state: 'off' });
        io.emit('timer-update', { device: deviceObj.endpoint, running: false });
        return res.json({ success: true, cancelled: true });
      }
    
      try {
        await fetch(commandUrl('POWER ON'));
        let endTime;
        if (tasmotaTimers[device] && tasmotaTimers[device].endTime > Date.now()) {
          endTime = tasmotaTimers[device].endTime + (minutes * 60_000);
          if (tasmotaTimers[device].timeout) clearTimeout(tasmotaTimers[device].timeout);
        } else {
          endTime = Date.now() + (minutes * 60_000);
        }
    
        const ms = endTime - Date.now();
        const timeout = setTimeout(async () => {
          try {
            await fetch(commandUrl('POWER OFF'));
            io.emit('device-status', { endpoint: deviceObj.endpoint, state: 'off' });
            io.emit('timer-update', { device: deviceObj.endpoint, running: false });
          } catch (error) {
            console.error('[Timer Expiry Error]', error.message);
          }
          delete tasmotaTimers[device];
        }, ms);
    
        tasmotaTimers[device] = { endTime, timeout };
    
        io.emit('timer-update', { device: deviceObj.endpoint, endTime, running: true });
    
        res.json({ success: true, endTime });
      } catch (error) {
        console.error('[Timer] Error:', error.message);
        res.status(500).json({ error: 'Timer start failed' });
      }
    });
    
    
    // Timer status for real device
    router.get('/:device/timer/status', (req, res) => {
      const timer = tasmotaTimers[req.params.device];
      const deviceObj = getDevice(req.params.device);
      const power =
        (deviceObj && timer && timer.endTime > Date.now()) ? 'on'
        : (deviceObj && tasmotaTimers[req.params.device]) ? 'off'
        : 'off';
      if (!timer) return res.json({ running: false, power });
      res.json({ running: true, remainingMs: Math.max(0, timer.endTime - Date.now()), power });
    });
    
    // Generic proxy (on/off/toggle/status) for Tasmota
    router.all('/:device/:action', async (req, res) => {
      const { device, action } = req.params;
      const deviceObj = getDevice(device);
      const commandString = commandMap[action];
      if (!deviceObj || isDemo(deviceObj) || !commandString) {
        return res.status(404).json({ error: 'Unknown device or action' });
      }
      try {
        const response = await fetch(
          `http://${deviceObj.ip}/cm?cmnd=${encodeURIComponent(commandString)}`
        );
        const data = (response.headers.get('content-type')||'').includes('json')
          ? await response.json()
          : await response.text();
        if (action !== 'status') {
          const state = (action==='on'||action==='toggle')?'on':'off';
          io.emit('device-status',{endpoint:deviceObj.endpoint,state});
        }
        res.status(response.status).send(data);
      } catch (error) {
        console.error('[Proxy]', error.message);
        res.status(500).json({ error: 'Proxy failed' });
      }
    });
    
    // Devices list endpoint (only verified devices)
    router.get('/devices', (req, res) => {
        console.log("TRY DEVICES?")
      try {
          res.json(JSON.parse(fs.readFileSync(DEVICES_PATH, 'utf8')));
        } catch (error) {
        console.error('Failed to read devices file:', error)
        res.status(500).json({ error: 'Failed to read devices file' });
      }
    });
    
    return router;
}