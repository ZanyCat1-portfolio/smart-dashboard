const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Singleton: one db connection for whole app
const db = new sqlite3.Database(path.join(__dirname, 'app.db'), (error) => {
  if (error) console.error('Could not open db', error);
  else console.log('[sqlite] Connected');
});

db.run('PRAGMA foreign_keys = ON;');

// Async helpers
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(error) {
      if (error) reject(error);
      else resolve(this);
    });
  });
}
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => error ? reject(error) : resolve(row));
  });
}
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows));
  });
}

module.exports = { db, run, get, all };