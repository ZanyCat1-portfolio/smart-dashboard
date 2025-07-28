const db = require('../../db/db');

function insertUser({ username, passwordHash, createdAt }) {
  const result = db.run(
    `INSERT INTO users (username, passwordHash, active, created_at)
     VALUES (?, ?, 1, ?)`,
    [username, passwordHash, createdAt]
  );
  return result.lastInsertRowid;
}

module.exports = {
  insertUser,
};
