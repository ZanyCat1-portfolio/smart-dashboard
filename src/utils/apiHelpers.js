const path = require('path');
const fs = require('fs');

const DEVICES_PATH = path.join(__dirname, '..', '..', 'public', 'devices.json');
// console.log('Loading devices from:', DEVICES_PATH);

let ioInstance;
function setIo(io) { ioInstance = io; }

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
  console.log('[Devices] Reloading device map...');
  deviceMap = loadDevices();
});

function getDevice(endpoint) {
  return deviceMap[endpoint.toLowerCase()];
}

function isDemo(device) {
  return !!device && device.example === true;
}

const demoState    = {};     // Device ON/OFF states (for demo)
const demoTimers   = {};     // Timers for demo devices
const demoGoveeState = {};   // In-memory state for demo Govee devices

function getDemoStatus(device) {
  // Return a mock status payload
  return { Status: { Power: demoState[device.endpoint] || 'off' } };
}

function emitDemoStatus(device, state) {
  demoState[device.endpoint] = state;
  // console.log(`[SOCKET EMIT] device-status for`, device.endpoint, state);
  if (ioInstance) ioInstance.emit('device-status', { endpoint: device.endpoint, state });
}

function getCurrentDemoTimerStates() {
  const out = {};
  const now = Date.now();
  for (const endpoint in demoTimers) {
    const t = demoTimers[endpoint];
    if (t && t.endTime && t.endTime > now) {
      out[endpoint] = {
        running: true,
        endTime: t.endTime
      };
    }
  }
  return out;
}

module.exports = {
  DEVICES_PATH,
  loadDevices,
  deviceMap,
  getDevice,
  isDemo,
  demoState,
  demoTimers,
  demoGoveeState,
  getDemoStatus,
  emitDemoStatus,
  getCurrentDemoTimerStates,
  setIo
};