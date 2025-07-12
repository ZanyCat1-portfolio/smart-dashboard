// ───── Initial Setup & Imports ─────
require('./src/api/verify-devices');
require('dotenv').config();

const express  = require('express');
const http     = require('http');
const path     = require('path');
const fs       = require('fs');
const mqtt     = require('mqtt');
const { Server } = require('socket.io');
const { getCurrentDemoTimerStates } = require('./src/utils/apiHelpers');
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

io.on('connection', (socket) => {
  const timers = getCurrentDemoTimerStates();
  socket.emit('timer-snapshot', timers);
});

// ───── All Routers from /src/api:  ─────
const apiRouter = require('./src/api')(io);
app.use(normalizedBase + 'api', apiRouter);

// ───── Static File Serving & SPA Fallback ─────

// Serve static assets from /public at root (for favicon, etc)
app.use(express.static(path.join(__dirname, 'public')));

// Serve frontend (built SPA) from /<basePath>
app.use(normalizedBase, express.static(path.join(__dirname, 'dist')));

// SPA fallback: any GET under /<basePath>/* not matching a static file → index.html
app.get(normalizedBase + '*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// const listEndpoints = require('express-list-endpoints');
// console.log(listEndpoints(app));

// ───── Start Server ─────

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  devLog(`🚀 Dashboard + WS listening on port ${PORT} (base: ${normalizedBase})`);
});
