const sqlite3 = require('sqlite3').verbose();
const { db, run, get, all } = require('./db');

// Create the devices table if it doesn't exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_id INTEGER NOT NULL,
      device_name TEXT NOT NULL,
      subscription TEXT,
      endpoint TEXT UNIQUE,
      is_public INTEGER DEFAULT 0,
      platform TEXT,
      FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
    )
  `);
});

// Add a new device
function addDevice({ contactId, deviceName, subscription, isPublic = false, platform = 'unknown' }) {
  // Ensure subscription is a JS object
  let endpoint = '';
  let subString = '';
  try {
    if (typeof subscription === 'string') {
      subString = subscription;
      subscription = JSON.parse(subscription);
    } else {
      subString = JSON.stringify(subscription);
    }
    endpoint = subscription.endpoint || '';
  } catch {
    subString = typeof subscription === 'string' ? subscription : '';
    endpoint = '';
  }

  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO devices (contact_id, device_name, subscription, endpoint, is_public, platform) VALUES (?, ?, ?, ?, ?, ?)`,
      [contactId, deviceName, subString, endpoint, isPublic ? 1 : 0, platform],
      function(error) {
        if (error) return reject(error);
        resolve(this.lastID);
      }
    );
  });
}


async function getDeviceByEndpoint(endpoint) {
  const devices = await all('SELECT * FROM devices');
  for (const device of devices) {
    let subscription = {};
    try {
      subscription = JSON.parse(device.subscription);
    } catch (error) {
      continue; // skip invalid rows
    }
    // console.log("sub.endpoint: ", subscription.endpoint)
    // console.log("endpoint: ", endpoint)
    if (subscription.endpoint === endpoint) {
      return device;
    }
  }
  return null;
}

// Remove a device by device ID
function getDeviceById(deviceId) {
  return get('SELECT * FROM devices WHERE id = ?', [deviceId]);
}


// Get all devices for a contact
function getDevicesByContactId(contactId) {
  console.log("what is contact id in DAL: ", contactId)
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM devices WHERE contact_id = ?`,
      [contactId],
      (error, rows) => {
        if (error) return reject(error);
        // Parse subscription JSON
        rows.forEach(device => {
          if (device.subscription) {
            try {
              device.subscription = JSON.parse(device.subscription);
            } catch {}
          }
        });
        console.log("rows is: ", rows)
        resolve(rows);
      }
    );
  });
}

// Remove a device by device ID
function removeDeviceById(deviceId) {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM devices WHERE id = ?`, [deviceId], function(error) {
      if (error) return reject(error);
      resolve(this.changes > 0);
    });
  });
}

function removeDevicesByContact(contactId) {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM devices WHERE contact_id = ?`, [contactId], function(error) {
      if (error) return reject(error);
      resolve(this.changes > 0);
    });
  });
}

async function getAllDevices() {
  console.log("getAllDevices?")
  return await all('SELECT * FROM devices');
}

async function removeAllDevices() {
  console.log("delete all?")
  const result = await db.run('DELETE FROM devices');
  console.log("result is: ", result)
  return result.changes; // number of rows deleted
}

// Export methods
module.exports = {
  addDevice,
  getDevicesByContactId,
  getDeviceByEndpoint,
  getDeviceById,
  getAllDevices,
  removeDeviceById,
  removeDevicesByContact,
  removeAllDevices
};