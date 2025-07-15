const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Set the DB path
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'database.sqlite');

// Initialize the database
const db = new Database(DB_PATH);

// Path to your schema.sql (or init.sql)
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

// Run schema if tables not present (idempotent)
const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
db.exec(schema);

module.exports = {
  db,

  // Convenience async helpers for DALs
  run: (...args) => db.prepare(args[0]).run(...args.slice(1)),
  get: (...args) => db.prepare(args[0]).get(...args.slice(1)),
  all: (...args) => db.prepare(args[0]).all(...args.slice(1)),
};