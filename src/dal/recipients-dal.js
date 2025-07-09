const sqlite3 = require('sqlite3').verbose();
const { db } = require('./db');

// Ensure table exists
db.run(`
  CREATE TABLE IF NOT EXISTS recipients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timer_id INTEGER NOT NULL,
    contact_id INTEGER NOT NULL,
    device_id INTEGER,  -- Optional: null = all devices for this contact
    FOREIGN KEY(timer_id) REFERENCES timers(id),
    FOREIGN KEY(contact_id) REFERENCES contacts(id),
    FOREIGN KEY(device_id) REFERENCES devices(id)
  )
`);
db.run(`
  CREATE UNIQUE INDEX IF NOT EXISTS uniq_recipient
  ON recipients (timer_id, contact_id, device_id)
`);

// Add a recipient (optionally device-specific)
function addRecipient(timerId, contactId, deviceId = null) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO recipients (timer_id, contact_id, device_id)
       VALUES (?, ?, ?)`,
      [timerId, contactId, deviceId],
      function (error) {
        if (error) return reject(error);
        resolve(this.lastID);
      }
    );
  });
}

// Get all recipients for a timer
function getRecipientsByTimer(timerId) {
  console.log("checkpoint 0")
  return new Promise((resolve, reject) => {
    console.log("checkpoint 1")
    db.all(
      `SELECT * FROM recipients WHERE timer_id = ?`,
      [timerId],
      (error, rows) => {
        console.log("checkpoint 2")
        if (error) {
          console.log("checkpoint 3")
          return reject(error);
        }
        console.log("checkpoint 4")
        resolve(rows);
      }
    );
    console.log("checkpoint 5")
  });
}

// Remove a recipient by ID
function removeRecipient(recipientId) {
  return new Promise((resolve, reject) => {
    db.run(
      `DELETE FROM recipients WHERE id = ?`,
      [recipientId],
      function (error) {
        if (error) return reject(error);
        resolve(this.changes > 0);
      }
    );
  });
}

// Remove all recipients for a given timer (e.g. on timer delete)
function removeRecipientsByTimer(timerId) {
  return new Promise((resolve, reject) => {
    db.run(
      `DELETE FROM recipients WHERE timer_id = ?`,
      [timerId],
      function (error) {
        if (error) return reject(error);
        resolve(this.changes > 0);
      }
    );
  });
}

module.exports = {
  addRecipient,
  getRecipientsByTimer,
  removeRecipient,
  removeRecipientsByTimer,
};
