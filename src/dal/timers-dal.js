const sqlite3 = require('sqlite3').verbose();
const { db } = require('./db');

// status should be: pending running paused canceled finished
// Create the timers table if it doesn't exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS timers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      minutes INTEGER NOT NULL,
      status TEXT,
      end_time INTEGER, 
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      recipients TEXT
    )
  `);
});

// Create a new timer
function createTimer({ name, minutes, status = 'pending', end_time = null, recipients = null }) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO timers (name, minutes, status, end_time, recipients)
       VALUES (?, ?, ?, ?, ?)`,
      [name, minutes, status, end_time, recipients],
      function(error) {
        if (error) return reject(error);
        db.get('SELECT * FROM timers WHERE id = ?', [this.lastID], (err, row) => {
          if (err) return reject(err);
          resolve(row);  
        });
      }
    );
  });
}

// Get a timer by ID
function getTimerById(timerId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM timers WHERE id = ?`,
      [timerId],
      (error, row) => {
        if (error) return reject(error);
        resolve(row);
      }
    );
  });
}

// Get all timers that are not finished or canceled
function getAllTimers(limit = 100) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM timers
       WHERE status NOT IN ('finished', 'canceled')
       ORDER BY created_at DESC
       LIMIT ?`,
      [limit],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      }
    );
  });
}

// Update a timer
function updateTimer(timerId, updates) {
  const keys = Object.keys(updates);
  if (keys.length === 0) return Promise.resolve(false);
  const setString = keys.map(key => `${key} = ?`).join(', ');
  const values = keys.map(key => updates[key]);
  values.push(timerId);

  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE timers SET ${setString} WHERE id = ?`,
      values,
      function(error) {
        if (error) return reject(error);
        resolve(this.changes > 0);
      }
    );
  });
}

function cancelTimer(timerId) {
  const now = new Date().toISOString();
  return updateTimer(timerId, {
    status: 'canceled',
    completed_at: now
  });
}

// Delete a timer
function deleteTimer(timerId) {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM timers WHERE id = ?`, [timerId], function(error) {
      if (error) return reject(error);
      resolve(this.changes > 0);
    });
  });
}

// Export methods
module.exports = {
  createTimer,
  getTimerById,
  getAllTimers,
  updateTimer,
  deleteTimer,
  cancelTimer,
};
