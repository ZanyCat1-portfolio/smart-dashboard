// ───── Initial Setup & Imports ─────
require('./src/api/verify-devices');
require('dotenv').config();

const express  = require('express');
const http     = require('http');
const path     = require('path');
const fs       = require('fs');
const mqtt     = require('mqtt');
const { Server } = require('socket.io');
const fetch    = (...args) => import('node-fetch').then(({default: f}) => f(...args));

// ───── Config & Helpers ─────

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

app.use(express.json());

// Web Push setup (for push notifications)
const webpush = require('web-push');
webpush.setVapidDetails(
  'mailto:you@example.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Expose VAPID public key to the frontend
app.get('/api/vapid-public-key', (req, res) => {
  res.type('text/plain').send(process.env.VAPID_PUBLIC_KEY);
});

// Logging helper (show only in dev unless forced)
function devLog(...args) {
  if (
    process.env.NODE_ENV !== 'production' ||
    process.env.FORCE_LOG === 'true'
  ) {
    console.log(...args);
  }
}

// ---- Base path config ----
const basePath        = process.env.BASE_PATH || '/';
const normalizedBase  = basePath.endsWith('/') ? basePath : basePath + '/';

// ───── Device Map & Loading ─────

const DEVICES_PATH = path.join(__dirname, 'public', 'devices.json');
console.log('Loading devices from:', DEVICES_PATH);

function loadDevices() {
  // Loads devices.json and attaches endpoint and label
  const raw = JSON.parse(fs.readFileSync(DEVICES_PATH, 'utf8'));
  const devices = {};
  Object.entries(raw).forEach(([key, val]) => {
    if (!key.startsWith('_') && val.verified) {
      devices[key.toLowerCase().replace(/\s+/g, '')] = {
        ...val,
        endpoint: key.toLowerCase().replace(/\s+/g, ''),
        label: val.label || key
      };
    }
  });
  return devices;
}

let deviceMap = loadDevices(); // Cached at startup
fs.watchFile(DEVICES_PATH, () => {
  devLog('[Devices] Reloading device map...');
  deviceMap = loadDevices();
});

function getDevice(endpoint) {
  return deviceMap[endpoint.toLowerCase()];
}

function isDemo(device) {
  return !!device && device.example === true;
}

// ───── MQTT Bridge (for Real Devices) ─────

const MQTT_URL = process.env.MQTT_URL || 'mqtt://localhost:1883';
const mqttClient = mqtt.connect(MQTT_URL, {
  username: process.env.MQTT_USER,
  password: process.env.MQTT_PASS,
});

// MQTT subscribe error
mqttClient.on('connect', () => {
  devLog(`[MQTT] Connected to ${MQTT_URL}`);
  mqttClient.subscribe(
    ['stat/+/RESULT','stat/+/POWER','tele/+/STATE'],
    error => error
      ? console.error('[MQTT] Subscribe error:', error)
      : devLog('[MQTT] Subscribed to status topics')
  );
});

mqttClient.on('message', (topic, payload) => {
  const msg = payload.toString();
  let endpoint, state, m;

  if ((m = topic.match(/^stat\/(.+?)\/RESULT$/))) {
    endpoint = m[1].toLowerCase();
    try { state = JSON.parse(msg).POWER.toLowerCase(); } catch {}
  } else if ((m = topic.match(/^stat\/(.+?)\/POWER$/))) {
    endpoint = m[1].toLowerCase();
    state = msg === 'ON' ? 'on' : 'off';
  } else if ((m = topic.match(/^tele\/(.+?)\/STATE$/))) {
    endpoint = m[1].toLowerCase();
    try { state = JSON.parse(msg).POWER.toLowerCase(); } catch {}
  }

  if (endpoint && state) {
    devLog(`[MQTT] ${endpoint} → ${state}`);
    io.emit('device-status', { endpoint, state });
  }
});

// ───── Timer & Contacts API Routes (Fixed Circular Dependency) ─────

// 1. Import the timer API *factory*
const timerApiFactory = require('./src/api/timer-api');
// 2. Create the timer API router (pass io)
const timerApiRouter = timerApiFactory(io);
// 3. Get the live timers object
const timers = timerApiRouter.timers || require('./src/api/timer-api').timers;
// 4. Import contacts-api as a function
const createContactsRouter = require('./src/api/contacts-api');
// 5. Create contacts API with io and timers
const contactsApi = createContactsRouter(io, timers);

// 6. Mount
app.use('/api/timers', timerApiRouter);
app.use('/api/contacts', contactsApi);


// ───── Main Router: All Other Device, Demo, and Example Routes ─────

const router = express.Router();

// ───── DEMO/EXAMPLE LOGIC (IN-MEMORY STATE) ─────

const demoState    = {};     // Device ON/OFF states (for demo)
const demoTimers   = {};     // Timers for demo devices
const demoGoveeState = {};   // In-memory state for demo Govee devices

function getDemoStatus(device) {
  // Return a mock status payload
  return { Status: { Power: demoState[device.endpoint] || 'off' } };
}

function emitDemoStatus(device, state) {
  demoState[device.endpoint] = state;
  console.log(`[SOCKET EMIT] device-status for`, device.endpoint, state);
  io.emit('device-status', { endpoint: device.endpoint, state });
}

// ───── DEMO DEVICE ROUTES ─────

// Device ON/OFF status endpoint for demo devices
router.get('/example/:device/status', (req, res) => {
  const deviceObj = getDevice(req.params.device);
  if (!deviceObj || !isDemo(deviceObj)) return res.status(404).json({ error: 'Unknown demo device' });

  const state = demoState[deviceObj.endpoint] || 'off';
  res.json({ Status: { Power: state } });
});

// DEMO Timer endpoints (on/off/cancel logic)
router.post('/example/:device/timer', (req, res) => {
  const { device } = req.params;
  const minutes = parseInt(req.body.minutes, 10);
  const deviceObj = getDevice(device);
  if (!deviceObj || !isDemo(deviceObj)) return res.status(404).json({ error: 'Unknown demo device' });

  if (isNaN(minutes) || minutes < 0) {
    return res.status(400).json({ error: 'Invalid minutes' });
  }

  // Cancel logic
  if (minutes === 0) {
    if (demoTimers[device]?.timeout) clearTimeout(demoTimers[device].timeout);
    delete demoTimers[device];
    emitDemoStatus(deviceObj, 'off');
    io.emit('timer-update', { device: deviceObj.endpoint, running: false });
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

  const ms = endTime - Date.now();
  const timeout = setTimeout(() => {
    emitDemoStatus(deviceObj, 'off');
    delete demoTimers[device];
    io.emit('timer-update', { device: deviceObj.endpoint, running: false });
  }, ms);

  demoTimers[device] = { endTime, timeout };

  io.emit('timer-update', { device: deviceObj.endpoint, endTime, running: true });
  res.json({ success: true, endTime });
});

// DEMO Timer status endpoint
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

// DEMO generic actions: on/off/toggle/status
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

  return res.json({ success: true, state: newState });
});

// ───── DEMO GOVEE ROUTES ─────
router.all('/example/govee/:device/:action', (req, res) => {
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
router.get('/example/govee/:device/timer/status', (req, res) => {
  res.json({ running: false, power: demoGoveeState[req.params.device] || 'off' });
});

// ───── REAL DEVICE ROUTES (TASMOTA & GOVEE) ─────

const commandMap = {
  toggle: 'POWER TOGGLE',
  on:     'POWER ON',
  off:    'POWER OFF',
  status: 'STATUS 0',
};

// Govee control endpoint (real device)
router.post('/govee/:name/:action', async (req, res) => {
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

// Tasmota timer endpoints (real devices)
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
  try {
    res.json(JSON.parse(fs.readFileSync(DEVICES_PATH, 'utf8')));
  } catch (error) {
    res.status(500).json({ error: 'Failed to read devices file' });
  }
});

// Mount all API routes at basePath
app.use(normalizedBase + 'api', router);

// ───── Static File Serving & SPA Fallback ─────

// Serve static assets from /public at root (for favicon, etc)
app.use(express.static(path.join(__dirname, 'public')));

// Serve frontend (built SPA) from /<basePath>
app.use(normalizedBase, express.static(path.join(__dirname, 'dist')));

// SPA fallback: any GET under /<basePath>/* not matching a static file → index.html
app.get(normalizedBase + '*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// ───── Start Server ─────

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  devLog(`🚀 Dashboard + WS listening on port ${PORT} (base: ${normalizedBase})`);
});
