const { db } = require('./db');

// Run at startup: create contacts table if not exists
db.run(`CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL
);`);

// Async wrapper helpers
function run(sql, params=[]) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(error) {
      if (error) reject(error);
      else resolve(this); // "this" gives access to lastID, changes
    });
  });
}

function get(sql, params=[]) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => error ? reject(error) : resolve(row));
  });
}

function all(sql, params=[]) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows));
  });
}

// CRUD operations
async function createContact(name) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO contacts (name) VALUES (?)',
      [name],
      function(error) {
        if (error) return reject(error);
        resolve(this.lastID);
      }
    );
  });
}

async function getContactById(id) {
  return await get('SELECT * FROM contacts WHERE id = ?', [id]);
}

async function getContactWithDevices(id) {
  const contact = await get('SELECT * FROM contacts WHERE id = ?', [id]);
  if (!contact) return null;
  const devices = await all('SELECT * FROM devices WHERE contact_id = ?', [id]);
  return { ...contact, devices };
  
}

async function getContactByName(name) {
  return await get('SELECT * FROM contacts WHERE name = ?', [name]);
}

async function getAllContacts() {
  return await all('SELECT * FROM contacts');
}

async function getAllContactsWithDevices() {
  const contacts = await all('SELECT * FROM contacts');
  const devices = await all('SELECT * FROM devices');
  return contacts.map(contact => ({
    ...contact,
    devices: devices.filter(device => device.contact_id === contact.id)
  }));
}

async function updateContact(id, name) {
  await run('UPDATE contacts SET name = ? WHERE id = ?', [name, id]);
  return getContactById(id);
}

async function removeContact(id) {
  const result = await run('DELETE FROM contacts WHERE id = ?', [id]);
  return result.changes > 0;
}

// Export the DAL API
module.exports = {
  createContact,
  getContactById,
  getContactWithDevices,
  getContactByName,
  getAllContacts,
  getAllContactsWithDevices,
  updateContact,
  removeContact,
};
