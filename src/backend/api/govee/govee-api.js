const express = require('express');

// /api/govee due to proxy-server.cjs and index.js .use statements
module.exports = (io) => {
    const router = express.Router();

    const { deviceMap } = require('../../utils/apiHelpers')
    
    router.post('/:name/:action', async (req, res) => {
      const { name, action } = req.params;
      const deviceObj = Object.values(deviceMap).find(device =>
        device.endpoint === name && device.type === 'govee'
      );
      if (!deviceObj || !['on','off'].includes(action)) {
        return res.status(400).json({ error: 'Invalid Govee request' });
      }
      try {
        const response = await fetch('https://developer-api.govee.com/v1/devices/control', {
          method: 'PUT',
          headers: {
            'Govee-API-Key': process.env.GOVEE_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({device: deviceObj.device, model: deviceObj.model, cmd:{name:'turn',value:action}})
        });
        const json = await response.json();
        res.json({ success: true, data: json });
      } catch (error) {
        console.error('[Govee] Error:', error.message);
        res.status(500).json({ error: 'Govee API error' });
      }
    });
    
    return router;
}