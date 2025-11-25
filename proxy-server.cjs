// ═══════════════════════════════════════════════════════════════
// IMPORTS & SETUP
// ═══════════════════════════════════════════════════════════════

// ─── Core Node Modules ───
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');

// ─── Express & Middleware ───
const express = require('express');
const session = require('express-session');

// ─── WebSocket & Push Notifications ───
const { Server } = require('socket.io');
const webpush = require('web-push');

// ─── MQTT ───
const mqttClient = require('./src/backend/mqtt/mqtt-client');

// ─── Backend Utilities ───
const { getCurrentDemoTimerStates } = require('./src/backend/utils/apiHelpers');
const { publishSmartTimerState, subscribeSmartTimerTopics } = require('./src/backend/utils/smartTimer-mqtt');
const { logMqtt } = require('./src/backend/utils/logger');

// ─── Data Access Layer ───
const smartTimerDAL = require('./src/backend/dal/smartTimer-dal.js');

// ─── API Routes ───
const apiRouter = require('./src/backend/api');

// ─── Dynamic Import ───
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

// ─── Environment & Verification ───
require('./verify-devices');
require('dotenv').config();

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const USE_HTTPS = process.env.USE_HTTPS === '1' || process.env.USE_HTTPS === 'true';
const MQTT_URL = process.env.MQTT_URL || 'mqtt://localhost:1883';
const PORT = process.env.PORT || 8080;
const basePath = process.env.BASE_PATH || '/';
const normalizedBase = basePath.endsWith('/') ? basePath : basePath + '/';

const oneDay = 1000 * 60 * 60 * 24;
const daysLoggedIn = 30;

// Device state cache
const deviceStates = {};

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function devLog(...args) {
  if (process.env.NODE_ENV !== 'production' || process.env.FORCE_LOG === 'true') {
    console.log(...args);
  }
}

function logError(...args) {
  console.error(...args);
}

// ═══════════════════════════════════════════════════════════════
// DEVICE STATE POLLING
// ═══════════════════════════════════════════════════════════════

async function pollTasmotaDevicesStatus() {
  const devicesPath = path.join(__dirname, 'public', 'devices.json');
  let devices;
  try {
    devices = JSON.parse(fs.readFileSync(devicesPath, 'utf8'));
  } catch (error) {
    logError('[Poll] Could not read devices.json:', error.message);
    return;
  }

  devLog('[Poll] Starting initial device status polling...');

  const promises = [];
  for (const [key, device] of Object.entries(devices)) {
    if (key.startsWith('_') || device.type !== 'tasmota' || !device.verified || device.example) continue;

    const endpoint = key.toLowerCase().replace(/\s+/g, '');
    const statusUrl = `http://${device.ip}/cm?cmnd=STATUS%200`;

    devLog(`[Poll] Polling ${endpoint} at ${device.ip}`);

    promises.push(
      fetch(statusUrl, { timeout: 5000 })
        .then(resp => resp.json())
        .then(data => {
          const state = data?.Status?.Power === 'ON' || data?.Status?.Power === 'on' || data?.Status?.Power === 1 ? 'on' : 'off';
          deviceStates[endpoint] = { state, lastUpdated: Date.now() };
          devLog(`[Poll] ${endpoint} → ${state}`);
        })
        .catch(error => {
          devLog(`[Poll] Failed to poll ${endpoint}:`, error.message);
        })
    );
  }

  await Promise.allSettled(promises);
  devLog('[Poll] Initial device status polling completed');
}

// ═══════════════════════════════════════════════════════════════
// SERVER SETUP
// ═══════════════════════════════════════════════════════════════

const app = express();

// Create HTTP or HTTPS server
let server;
if (USE_HTTPS) {
  const options = {
    key: fs.readFileSync(path.resolve(__dirname, 'cert/dev-key.pem')),
    cert: fs.readFileSync(path.resolve(__dirname, 'cert/dev-cert.pem')),
  };
  server = https.createServer(options, app);
  console.log("[startup] HTTPS enabled.");
} else {
  server = http.createServer(app);
  console.log("[startup] HTTP enabled.");
}

// Socket.IO setup
const io = new Server(server, { 
  cors: { origin: '*' }, 
  path: process.env.BASE_PATH ? process.env.BASE_PATH.replace(/\/?$/, '') + '/socket.io' : '/socket.io'
});

// Event bus setup (note: this imports from frontend utils, might need adjustment)
const eventBus = require('./src/backend/utils/eventBus.js');
eventBus.setIo(io);

// Web Push setup
webpush.setVapidDetails(
  'mailto:you@example.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// ═══════════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════════

app.use(express.json());

app.use(session({
  secret: 'your-secret-here',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    maxAge: oneDay * daysLoggedIn,
    httpOnly: true,
  }
}));

// Request logging (development only)
app.use((req, res, next) => {
  devLog('[EXPRESS] Request:', req.method, req.url);
  next();
});

// ═══════════════════════════════════════════════════════════════
// START SERVER EXECUTION
// ═══════════════════════════════════════════════════════════════

// Poll device states after verification
pollTasmotaDevicesStatus();

// ═══════════════════════════════════════════════════════════════
// MQTT SETUP
// ═══════════════════════════════════════════════════════════════

// Subscribe to SmartTimer topics
subscribeSmartTimerTopics(mqttClient, io, smartTimerDAL);

// MQTT connection handler
mqttClient.on('connect', () => {
  logMqtt(`Connected to ${MQTT_URL}`);
  mqttClient.subscribe(
    [
      'stat/+/RESULT',
      'stat/+/POWER',
      'tele/+/STATE',
      'smarthome/smarttimer/+/command'
    ],
    error => error
      ? logError('[MQTT] Subscribe error:', error)
      : logMqtt('Subscribed to status and SmartTimer topics')
  );
});

// MQTT message handler
mqttClient.on('message', (topic, payload) => {
  const msg = payload.toString();
  let endpoint, state, m;

  // ─── Handle Tasmota device messages ───
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
    // Update cache
    deviceStates[endpoint] = { state, lastUpdated: Date.now() };
    devLog(`[MQTT] ${endpoint} → ${state}`);
    io.emit('device-status', { endpoint, state });
  }

  // ─── Handle SmartTimer MQTT commands ───
  if (topic.startsWith('smarthome/smarttimer/')) {
    const parts = topic.split('/');
    const timerId = parts[2];
    const action = parts[3];
    let payloadObj = {};
    try { payloadObj = JSON.parse(msg); } catch {}

    devLog(`[MQTT][SmartTimer] Received command for timer ${timerId}:`, payloadObj);

    if (action === 'command' && payloadObj.action) {
      switch (payloadObj.action) {
        case 'start':
          if (payloadObj.duration) {
            smartTimerDAL.startTimer(timerId, payloadObj.duration);
            io.emit('smart-timer-update', { id: timerId, state: 'running' });
          }
          break;
        case 'cancel':
          smartTimerDAL.cancelTimer(timerId);
          io.emit('smart-timer-update', { id: timerId, state: 'canceled' });
          break;
        case 'pause':
          smartTimerDAL.pauseTimer(timerId);
          io.emit('smart-timer-update', { id: timerId, state: 'paused' });
          break;
      }
    }
  }
});

// ═══════════════════════════════════════════════════════════════
// SOCKET.IO HANDLERS
// ═══════════════════════════════════════════════════════════════

io.on('connection', (socket) => {
  // Send demo timer snapshot
  const demoTimers = getCurrentDemoTimerStates();
  socket.emit('timer-snapshot', demoTimers);

  // Send smart timers snapshot
  const { smartTimers } = require('./src/backend/data/smartTimers.js');
  socket.emit('smart-timer-snapshot', Object.values(smartTimers));

  // Send devices snapshot
  const { devices } = require('./src/backend/data/devices');
  socket.emit('devices:snapshot', Object.values(devices));

  // Send device states snapshot
  socket.emit('device-states:snapshot', deviceStates);

  // Send users snapshot (without password hashes)
  const { users } = require('./src/backend/data/users');
  socket.emit('users:snapshot', Object.values(users).map(({ passwordHash, ...u}) => u));
});

// ═══════════════════════════════════════════════════════════════
// API ROUTES
// ═══════════════════════════════════════════════════════════════

// VAPID public key endpoint
app.get(normalizedBase + 'api/vapid-public-key', (req, res) => {
  res.type('text/plain').send(process.env.VAPID_PUBLIC_KEY);
});

// Mount all API routes
app.use(normalizedBase + 'api', apiRouter(io, deviceStates));

// ═══════════════════════════════════════════════════════════════
// STATIC FILE SERVING & SPA FALLBACK
// ═══════════════════════════════════════════════════════════════

// Serve static assets from /public
app.use(express.static(path.join(__dirname, 'public')));

// Serve frontend SPA from /dist
app.use(normalizedBase, express.static(path.join(__dirname, 'dist')));

// SPA fallback for client-side routing
app.get(normalizedBase + '*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// ═══════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════

server.listen(PORT, '0.0.0.0', () => {
  devLog(`🚀 Dashboard + WS listening on port ${PORT} (base: ${normalizedBase})`);
});

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = {
  mqttClient
};
