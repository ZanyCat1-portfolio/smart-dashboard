// verify‑devices.js
const fs       = require('fs');
const path     = require('path');
const axios    = require('axios');
const chokidar = require('chokidar');

const DEVICES_FILE  = path.join(__dirname, '../../public', 'devices.json');
console.log("dirname: ", __dirname)
let  isWriting     = false;

// load & save
function load() {
  return JSON.parse(fs.readFileSync(DEVICES_FILE, 'utf8'));
}
function save(devices) {
  isWriting = true;
  fs.writeFileSync(DEVICES_FILE, JSON.stringify(devices, null, 2));
  isWriting = false;
}

// ping checker
async function check(d) {
  if (d.type !== 'tasmota' || !d.ip || d.example === true) return true;
  const url = `http://${d.ip}/cm?cmnd=${encodeURIComponent('STATUS 0')}`;
  try {
    await axios.get(url, { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

// the actual verifier
async function verifyAll() {
  const raw = load();
  let dirty = false;

  for (const [key, d] of Object.entries(raw)) {
    if (key.startsWith('_')) continue;
    const ok = await check(d);
    console.log(`[verify] ${key} → ${ok}`);
    if (d.verified !== ok) {
      raw[key].verified = ok;
      dirty = true;
    }
  }

  if (dirty) {
    console.log('[verify] writing updated devices.json');
    save(raw);
  }
}

// run once on startup
verifyAll();

// watch for external changes to devices.json
chokidar.watch(DEVICES_FILE, { ignoreInitial: true })
  .on('change', () => {
    if (isWriting) return;    // skip our own writes
    console.log('[watcher] devices.json changed — re-running verifier');
    verifyAll();
  });

// export if you need to hook into your server startup
module.exports = { verifyAll };
