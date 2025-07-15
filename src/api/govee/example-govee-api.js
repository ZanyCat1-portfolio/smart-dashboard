const express = require('express');

// /api/example-govee due to proxy-server.cjs and index.js .use statements
module.exports = (io) => {
    
    const router = express.Router();
    
    const { DEVICES_PATH, isDemo, getDevice, emitDemoStatus, getDemoStatus, demoGoveeState } = require('../../utils/apiHelpers')
    
    // ───── EXAMPLE GOVEE DEVICE ROUTES ─────
    
    router.all('/:device/:action', (req, res) => {
      const { device, action } = req.params;
      const deviceObj = getDevice(device);
      if (!deviceObj || deviceObj.type !== 'govee' || !isDemo(deviceObj) || !['on', 'off', 'toggle', 'status'].includes(action)) {
        return res.status(404).json({ error: 'Unknown demo Govee device or action' });
      }
    
      if (action === 'status') {
        return res.json({
          Status: { Power: demoGoveeState[deviceObj.endpoint] || 'off' }
        });
      }
    
      let curr = demoGoveeState[deviceObj.endpoint] || 'off';
      let newState;
      if (action === 'toggle') {
        newState = curr === 'on' ? 'off' : 'on';
      } else if (action === 'on') {
        newState = 'on';
      } else if (action === 'off') {
        newState = 'off';
      }
      demoGoveeState[deviceObj.endpoint] = newState;
    
      io.emit('device-status', { endpoint: deviceObj.endpoint, state: newState });
    
      return res.json({ success: true, state: newState });
    });
    
    // Demo Govee timer/status (expand as needed)
    router.get('/:device/timer/status', (req, res) => {
      res.json({ running: false, power: demoGoveeState[req.params.device] || 'off' });
    });
    return router;
};