require('./verify-devices');
require('dotenv').config();

const express = require('express');
const http    = require('http');
const path    = require('path');
const fs      = require('fs');
const mqtt    = require('mqtt');
const { Server } = require('socket.io');
const fetch   = (...args) => import('node-fetch').then(({default: f}) => f(...args));

// ───── Config & Helpers ─────

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

app.use(express.json());

// ---- Base path config ----
const basePath = process.env.BASE_PATH || '/';
const normalizedBase = basePath.endsWith('/') ? basePath : basePath + '/';

function devLog(...args) {
  if (
    process.env.NODE_ENV !== 'production' ||
    process.env.FORCE_LOG === 'true'
  ) {
    console.log(...args);
  }
}

const DEVICES_PATH = path.join(__dirname, 'public', 'devices.json');
console.log('Loading devices from:', DEVICES_PATH);
function loadDevices() {
  // Loads the devices.json file and attaches endpoint and label to each device.
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

// Cached devices, refreshed only on startup for now.
let deviceMap = loadDevices();
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

// ───── Demo/Example Logic ─────

const demoState = {};     // In-memory state for all example devices
const demoTimers = {};    // In-memory timer state for demo devices

function getDemoStatus(device) {
  // Return a mock status payload
  return { Status: { Power: demoState[device.endpoint] || 'off' } };
}

// Helper to emit WS status for demo devices
function emitDemoStatus(device, state) {
  demoState[device.endpoint] = state;
  console.log(`[SOCKET EMIT] device-status for`, device.endpoint, state);
  io.emit('device-status', { endpoint: device.endpoint, state });
}

// ───── MQTT Bridge (real devices only) ─────

const MQTT_URL = process.env.MQTT_URL || 'mqtt://localhost:1883';
const mqttClient = mqtt.connect(MQTT_URL, {
  username: process.env.MQTT_USER,
  password: process.env.MQTT_PASS,
});

mqttClient.on('connect', () => {
  devLog(`[MQTT] Connected to ${MQTT_URL}`);
  mqttClient.subscribe(
    ['stat/+/RESULT','stat/+/POWER','tele/+/STATE'],
    err => err
      ? console.error('[MQTT] Subscribe error:', err)
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

// ───── API Routes ─────

// const router = express.Router();
// const timerApi = require('./timer-api')(io);
// app.use('/api/timers', timerApi);
const router = express.Router();
const timerApi = require('./timer-api')(io);
app.use('/api/timers', timerApi);

// --------- DEMO ROUTES ---------------

// Device ON/OFF status endpoint for demo/example devices
router.get('/example/:device/status', (req, res) => {
  const dev = getDevice(req.params.device);
  if (!dev || !isDemo(dev)) return res.status(404).json({ error: 'Unknown demo device' });

  // Determine state (you might track ON/OFF with a variable or demoTimers logic)
  // For example, if timer is running, state is ON. If not, OFF.
  const state = demoState[dev.endpoint] || 'off';
  res.json({ Status: { Power: state } });
});

// DEMO Timer endpoints
router.post('/example/:device/timer', (req, res) => {
  const { device } = req.params;
  const minutes = parseInt(req.body.minutes, 10);
  const dev = getDevice(device);
  if (!dev || !isDemo(dev)) return res.status(404).json({ error: 'Unknown demo device' });

  // ALLOW 0 as cancel
  if (isNaN(minutes) || minutes < 0) {
    return res.status(400).json({ error: 'Invalid minutes' });
  }

  if (minutes === 0) {
    if (demoTimers[device]?.timeout) clearTimeout(demoTimers[device].timeout);
    delete demoTimers[device];
    emitDemoStatus(dev, 'off');
    // --- Emit timer-update: stopped ---
    io.emit('timer-update', { device: dev.endpoint, running: false });
    return res.json({ success: true, cancelled: true });
  }

  // Start new timer or add time
  let endTime;
  if (demoTimers[device] && demoTimers[device].endTime > Date.now()) {
    endTime = demoTimers[device].endTime + minutes * 60_000;
    if (demoTimers[device].timeout) clearTimeout(demoTimers[device].timeout);
  } else {
    endTime = Date.now() + minutes * 60_000;
  }

  // Turn on now
  emitDemoStatus(dev, 'on');

  const ms = endTime - Date.now();
  const timeout = setTimeout(() => {
    emitDemoStatus(dev, 'off');
    delete demoTimers[device];
    // --- Emit timer-update: stopped (on timeout) ---
    io.emit('timer-update', { device: dev.endpoint, running: false });
  }, ms);

  demoTimers[device] = { endTime, timeout };

  // --- Emit timer-update: started/added ---
  io.emit('timer-update', { device: dev.endpoint, endTime, running: true });

  res.json({ success: true, endTime });
});

// DEMO Timer status with power state
router.get('/example/:device/timer/status', (req, res) => {
  const t = demoTimers[req.params.device];
  const dev = getDevice(req.params.device);
  const power =
    (dev && t && t.endTime > Date.now()) ? 'on'
    : (dev && demoTimers[req.params.device]) ? 'off'
    : 'off';
  if (!t) return res.json({ running: false, power });
  res.json({ running: true, remainingMs: Math.max(0, t.endTime - Date.now()), power });
});

const DEMO_ACTIONS = ['on', 'off', 'toggle', 'status'];

router.all('/example/:device/:action', (req, res) => {
  const { device, action } = req.params;
  const dev = getDevice(device);
  if (!dev || !isDemo(dev) || !DEMO_ACTIONS.includes(action.toLowerCase())) {
    return res.status(404).json({ error: 'Unknown demo device or action' });
  }

  // Status
  if (action === 'status') {
    return res.json(getDemoStatus(dev));
  }

  const act = action.toLowerCase();

  // Toggle/on/off logic
  let curr = demoState[dev.endpoint] || 'off';
  let newState;
  if (act === 'toggle') {
    newState = curr === 'on' ? 'off' : 'on';
  } else if (act === 'on') {
    newState = 'on';
  } else if (act === 'off') {
    newState = 'off';
  }
  console.log('Toggling:', { device, act, newState, dev });
  console.log('emitDemoStatus call:', { endpoint: dev?.endpoint, newState });
  emitDemoStatus(dev, newState);

  return res.json({ success: true, state: newState });
});

// -------- DEMO Govee -----------

// In-memory state for demo/example Govee devices
const demoGoveeState = {};

// Demo Govee device ON/OFF/status
router.all('/example/govee/:device/:action', (req, res) => {
  const { device, action } = req.params;
  const dev = getDevice(device);
  if (!dev || dev.type !== 'govee' || !isDemo(dev) || !['on', 'off', 'toggle', 'status'].includes(action)) {
    return res.status(404).json({ error: 'Unknown demo Govee device or action' });
  }

  // Status
  if (action === 'status') {
    return res.json({
      Status: { Power: demoGoveeState[dev.endpoint] || 'off' }
    });
  }

  // Toggle/on/off logic
  let curr = demoGoveeState[dev.endpoint] || 'off';
  let newState;
  if (action === 'toggle') {
    newState = curr === 'on' ? 'off' : 'on';
  } else if (action === 'on') {
    newState = 'on';
  } else if (action === 'off') {
    newState = 'off';
  }
  demoGoveeState[dev.endpoint] = newState;

  // Optional: emit status to websockets if you want demo Govee to show real-time updates
  io.emit('device-status', { endpoint: dev.endpoint, state: newState });

  return res.json({ success: true, state: newState });
});

// Optionally, a timer/status route for demo Govee devices (if your frontend expects it)
router.get('/example/govee/:device/timer/status', (req, res) => {
  // You can expand with timer logic if needed
  res.json({ running: false, power: demoGoveeState[req.params.device] || 'off' });
});



// -------- REAL DEVICE ROUTES --------

const commandMap = {
  toggle: 'POWER TOGGLE',
  on:     'POWER ON',
  off:    'POWER OFF',
  status: 'STATUS 0',
};

router.post('/govee/:name/:action', async (req, res) => {
  const { name, action } = req.params;
  const device = Object.values(deviceMap).find(d =>
    d.endpoint === name && d.type === 'govee'
  );
  if (!device || !['on','off'].includes(action)) {
    return res.status(400).json({ error: 'Invalid Govee request' });
  }
  try {
    const r = await fetch('https://developer-api.govee.com/v1/devices/control', {
      method: 'PUT',
      headers: {
        'Govee-API-Key': process.env.GOVEE_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({device: device.device, model: device.model, cmd:{name:'turn',value:action}})
    });
    const json = await r.json();
    res.json({ success: true, data: json });
  } catch (e) {
    console.error('[Govee] Error:', e.message);
    res.status(500).json({ error: 'Govee API error' });
  }
});

// Tasmota timer endpoints (real devices)
const timers = {};

router.post('/:device/timer', async (req, res) => {
  const { device } = req.params;
  const minutes    = parseInt(req.body.minutes, 10);
  const dev        = getDevice(device);
  if (!dev || isDemo(dev)) return res.status(404).json({ error: 'Unknown device' });
  if (isNaN(minutes) || minutes < 0) return res.status(400).json({ error: 'Invalid minutes' });

  const cmdUrl = cmd => `http://${dev.ip}/cm?cmnd=${encodeURIComponent(cmd)}`;

  // Handle cancel case
  if (minutes === 0) {
    if (timers[device]?.timeout) clearTimeout(timers[device].timeout);
    delete timers[device];
    await fetch(cmdUrl('POWER OFF')).catch(e => console.error(e));
    io.emit('device-status', { endpoint: dev.endpoint, state: 'off' });
    io.emit('timer-update', { device: dev.endpoint, running: false });
    return res.json({ success: true, cancelled: true });
  }

  try {
    await fetch(cmdUrl('POWER ON'));
    let endTime;
    if (timers[device] && timers[device].endTime > Date.now()) {
      endTime = timers[device].endTime + (minutes * 60_000);
      if (timers[device].timeout) clearTimeout(timers[device].timeout);
    } else {
      endTime = Date.now() + (minutes * 60_000);
    }

    const ms = endTime - Date.now();
    const timeout = setTimeout(async () => {
      try {
        await fetch(cmdUrl('POWER OFF'));
        io.emit('device-status', { endpoint: dev.endpoint, state: 'off' });
        io.emit('timer-update', { device: dev.endpoint, running: false });
      } catch (e) {
        console.error('[Timer Expiry Error]', e.message);
      }
      delete timers[device];
    }, ms);

    timers[device] = { endTime, timeout };

    io.emit('timer-update', { device: dev.endpoint, endTime, running: true });

    res.json({ success: true, endTime });
  } catch (e) {
    console.error('[Timer] Error:', e.message);
    res.status(500).json({ error: 'Timer start failed' });
  }
});

// Timer status with power state
router.get('/:device/timer/status', (req, res) => {
  const t = timers[req.params.device];
  const dev = getDevice(req.params.device);
  const power =
    (dev && t && t.endTime > Date.now()) ? 'on'
    : (dev && timers[req.params.device]) ? 'off'
    : 'off';
  if (!t) return res.json({ running: false, power });
  res.json({ running: true, remainingMs: Math.max(0, t.endTime - Date.now()), power });
});

// Generic Tasmota proxy (real devices)
router.all('/:device/:action', async (req, res) => {
  const { device, action } = req.params;
  const dev    = getDevice(device);
  const cmdStr = commandMap[action];
  if (!dev || isDemo(dev) || !cmdStr) {
    return res.status(404).json({ error: 'Unknown device or action' });
  }
  try {
    const r = await fetch(
      `http://${dev.ip}/cm?cmnd=${encodeURIComponent(cmdStr)}`
    );
    const data = (r.headers.get('content-type')||'').includes('json')
      ? await r.json()
      : await r.text();
    if (action !== 'status') {
      const state = (action==='on'||action==='toggle')?'on':'off';
      io.emit('device-status',{endpoint:dev.endpoint,state});
    }
    res.status(r.status).send(data);
  } catch (e) {
    console.error('[Proxy]', e.message);
    res.status(500).json({ error: 'Proxy failed' });
  }
});

// Devices list (same as before, but only verified devices)
router.get('/devices', (req, res) => {
  // Re-read in case the file changed
  try {
    res.json(JSON.parse(fs.readFileSync(DEVICES_PATH, 'utf8')));
  } catch (e) {
    res.status(500).json({ error: 'Failed to read devices file' });
  }
});

// Mount API routes at basePath
app.use(normalizedBase + 'api', router);

// ───── Static & SPA Fallback ─────

// Always serve static assets in /public at root (favicons, etc)
app.use(express.static(path.join(__dirname, 'public')));

// Serve frontend from /<basePath>
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
