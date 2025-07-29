// ───── Initial Setup & Imports ─────
require('./src/api/verify-devices');
require('dotenv').config();

const express  = require('express');
// const http     = require('http');
const https     = require('https');
const path     = require('path');
const fs       = require('fs');
// const mqtt     = require('mqtt');
const mqttClient = require('./src/mqtt/mqtt-client.js');
const { Server } = require('socket.io');
const { getCurrentDemoTimerStates } = require('./src/utils/apiHelpers');
const fetch    = (...args) => import('node-fetch').then(({default: f}) => f(...args));
const { publishSmartTimerState, subscribeSmartTimerTopics } = require('./src/utils/smartTimer-mqtt')
const { logMqtt } = require('./src/utils/logger');


const options = {
  key: fs.readFileSync(path.resolve(__dirname, 'cert/dev-key.pem')),
  cert: fs.readFileSync(path.resolve(__dirname, 'cert/dev-cert.pem'))
}
// ---- New: Import SmartTimer DAL for DB operations (adjust path as needed)
const smartTimerDAL = require('./src/dal/smartTimer-dal.js');

// ───── Config & Helpers ─────

const app    = express();
// const server = http.createServer(app);
const server = https.createServer(options, app);
const io     = new Server(server, { cors: { origin: '*' } });
const eventBus = require('./src/utils/eventBus.js');
eventBus.setIo(io);

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
// console.log("what is base path?:", process.env.BASE_PATH)

// ───── MQTT Bridge (for Real Devices & SmartTimers) ─────

// const MQTT_URL = process.env.MQTT_URL || 'mqtt://localhost:1883';
// const mqttClient = mqtt.connect(MQTT_URL, {
//   username: process.env.MQTT_USER,
//   password: process.env.MQTT_PASS,
// });
subscribeSmartTimerTopics(mqttClient, io, smartTimerDAL)

// ---- Existing device MQTT subscribe logic
mqttClient.on('connect', () => {
  logMqtt(`Connected to ${MQTT_URL}`);
  mqttClient.subscribe(
    [
      'stat/+/RESULT',
      'stat/+/POWER',
      'tele/+/STATE',
      // --- New: Subscribe to SmartTimer control topics
      'smarthome/smarttimer/+/command'
    ],
    error => error
      ? logError('[MQTT] Subscribe error:', error)
      : logMqtt('Subscribed to status and SmartTimer topics')
  );
});

mqttClient.on('message', (topic, payload) => {
  const msg = payload.toString();
  let endpoint, state, m;

  // ---- Existing Tasmota MQTT handling
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

  // ---- New: Handle SmartTimer MQTT control topics
  if (topic.startsWith('smarthome/smarttimer/')) {
    const parts = topic.split('/');
    const timerId = parts[2];
    const action = parts[3]; // Should be "command"
    let payloadObj = {};
    try { payloadObj = JSON.parse(msg); } catch {}

    devLog(`[MQTT][SmartTimer] Received command for timer ${timerId}:`, payloadObj);

    // EXAMPLE: Handle supported commands from MQTT
    // E.g. payload: { action: 'start', duration: 600 }
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
        // Add more actions as needed
      }
    }
  }
});

// ---- Existing: On connection, emit demo timer state
io.on('connection', (socket) => {
  // console.log('[SOCKET.IO] Client connected:', socket.id);

  const demoTimers = getCurrentDemoTimerStates();
  socket.emit('timer-snapshot', demoTimers);
  // console.log('[SOCKET.IO] Sent timer-snapshot:', demoTimers);

  const { smartTimers } = require('./src/data/smartTimers.js');
  socket.emit('smart-timer-snapshot', Object.values(smartTimers));
  // console.log('[SOCKET.IO] Sent smart-timer-snapshot:', smartTimers);

  // Devices:
  const { devices } = require('./src/data/devices');
    socket.emit('devices:snapshot', Object.values(devices));
    // console.log('[SOCKET.IO] Sent devices:snapshot:', devices);

    // Users:
    const { users } = require('./src/data/users');
    socket.emit('users:snapshot', Object.values(users));
    // console.log('[SOCKET.IO] Sent users:snapshot:', users);
  });

  const session = require('express-session');
  const oneDay = 1000 * 60 * 60 * 24;
  const daysLoggedIn = 30
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

// ───── All Routers from /src/api:  ─────
const apiRouter = require('./src/api')(io);
app.use(normalizedBase + 'api', apiRouter); // gives /api to url

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
server.listen(PORT, '0.0.0.0', () => {
  devLog(`🚀 Dashboard + WS listening on port ${PORT} (base: ${normalizedBase})`);
});

module.exports = {
  mqttClient
}