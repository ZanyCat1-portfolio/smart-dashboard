const mDns = require('multicast-dns')();

const path = require('path');
const fs = require('fs');

const DEVICES_PATH = path.join(__dirname, '..', '..', '..', 'public', 'devices.json');
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
  console.log("what is devices:")
  console.log(devices)
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
const wledIpCache = {};      // Cache resolved IPs for WLED devices: {mdnsName: {ip, lastResolved}}

async function resolveWledIp(mdnsName) {
  const cacheKey = `${mdnsName}.local`;
  const cached = wledIpCache[cacheKey];

  // Return cached IP if recent (within 5 minutes)
  if (cached && Date.now() - cached.lastResolved < 5 * 60 * 1000) {
    console.log(`[WLED] Using cached IP for ${cacheKey}: ${cached.ip}`);
    return cached.ip;
  }

  return new Promise((resolve, reject) => {
    const hostname = `${mdnsName}.local`;
    let resolved = false;

    console.log(`[WLED] Resolving ${hostname} via mDNS...`);

    const query = {
      questions: [{
        name: hostname,
        type: 'A'
      }]
    };

    mDns.query(query);

    const responseHandler = (response) => {
      if (resolved) return; // Already resolved

      // Look for A records matching our hostname
      for (const answer of response.answers || []) {
        if (answer.name === hostname && answer.type === 'A') {
          const ip = answer.data;
          console.log(`[WLED] Resolved ${hostname} to ${ip}`);

          // Clean up listener
          mDns.removeListener('response', responseHandler);

          // Cache the resolved IP
          wledIpCache[cacheKey] = {
            ip,
            lastResolved: Date.now()
          };

          resolved = true;
          resolve(ip);
          return;
        }
      }
    };

    mDns.on('response', responseHandler);

    // Timeout after 5 seconds
    setTimeout(() => {
      if (!resolved) {
        mDns.removeListener('response', responseHandler);

        if (cached) {
          console.log(`[WLED] mDNS resolution timeout, using stale IP for ${cacheKey}: ${cached.ip}`);
          resolve(cached.ip);
        } else {
          console.warn(`[WLED] mDNS resolution timeout for ${hostname}`);
          reject(new Error(`mDNS resolution timeout for ${hostname}`));
        }
      }
    }, 5000);
  });
}

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
  wledIpCache,
  resolveWledIp,
  getDemoStatus,
  emitDemoStatus,
  getCurrentDemoTimerStates,
  setIo
};
