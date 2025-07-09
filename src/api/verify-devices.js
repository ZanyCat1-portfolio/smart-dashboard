// manages tasmota and devices.json
// may move that to db later; keep for now

const fs       = require('fs');
const path     = require('path');
const axios    = require('axios');
const chokidar = require('chokidar');

const DEVICES_FILE_PATH  = path.join(__dirname, '../../public', 'devices.json');
console.log("dirname: ", __dirname);
let  isCurrentlyWriting     = false;

// load & save
function loadDevices() {
  return JSON.parse(fs.readFileSync(DEVICES_FILE_PATH, 'utf8'));
}
function saveDevices(devicesObject) {
  isCurrentlyWriting = true;
  fs.writeFileSync(DEVICES_FILE_PATH, JSON.stringify(devicesObject, null, 2));
  isCurrentlyWriting = false;
}

// ping checker
async function checkDevice(device) {
  if (device.type !== 'tasmota' || !device.ip || device.example === true) return true;
  const statusUrl = `http://${device.ip}/cm?cmnd=${encodeURIComponent('STATUS 0')}`;
  try {
    await axios.get(statusUrl, { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

// the actual verifier
async function verifyAllDevices() {
  const devicesObject = loadDevices();
  let wasModified = false;

  for (const [deviceKey, device] of Object.entries(devicesObject)) {
    if (deviceKey.startsWith('_')) continue;
    const isVerified = await checkDevice(device);
    console.log(`[verify] ${deviceKey} → ${isVerified}`);
    if (device.verified !== isVerified) {
      devicesObject[deviceKey].verified = isVerified;
      wasModified = true;
    }
  }

  if (wasModified) {
    console.log('[verify] writing updated devices.json');
    saveDevices(devicesObject);
  }
}

// run once on startup
verifyAllDevices();

// watch for external changes to devices.json
chokidar.watch(DEVICES_FILE_PATH, { ignoreInitial: true })
  .on('change', () => {
    if (isCurrentlyWriting) return;    // skip our own writes
    console.log('[watcher] devices.json changed — re-running verifier');
    verifyAllDevices();
  });

// export if you need to hook into your server startup
module.exports = { verifyAllDevices };
