const db = require('../../db/db');
const User = require('../models/User');

const userDAL = {
  createUser: ({ username, email, passwordHash }) => {
    const now = new Date().toISOString();
    const res = db.run(
      `INSERT INTO users (username, email, passwordHash, active, created_at)
      VALUES (?, ?, ?, 1, ?)`,
      username, email || null, passwordHash, now
    );
    return userDAL.getUserById(res.lastInsertRowid);
  },

  getUserById: (id) => {
    const row = db.get(`SELECT id, username, email, created_at AS createdAt, active FROM users WHERE id = ?`, [id]);
    return row ? new User(row) : null;
  },

  getUserByUsername: (username) => {
    const row = db.get('SELECT id, username, email, created_at AS createdAt, active FROM users WHERE username = ?', [username]);
    return row ? new User(row) : null;
  },

  getUserByEmail: (email) => {
    const row = db.get('SELECT id, username, email, created_at AS createdAt, active FROM users WHERE email = ?', [email]);
    return row ? new User(row) : null;
  },

  getUserAuthByUsername(username) {
    const row = db.get('SELECT * FROM users WHERE username = ? AND active = 1', [username])
    return row ? new User(row) : null;
  },

  findUsersByName: (username) => {
    const rows = db.all(`
      SELECT id, username, email, created_at AS createdAt, active FROM users
      WHERE username LIKE '%' || ? || '%'
      ORDER BY username ASC
    `, [username]);
    return rows.map(row => new User(row));
  },

  findUsersByExactUsername: (username) => {
    const rows = db.all(`
      SELECT id, username, email, created_at AS createdAt, active FROM users WHERE LOWER(username) = LOWER(?)
    `, [username]);
    return rows.map(row => new User(row));
  },

  listUsers: (filter = {}) => {
    let sql = 'SELECT id, username, email, created_at AS createdAt, active FROM users';
    const params = [];

    if (typeof filter.active === 'boolean') {
      sql += ' WHERE active = ?';
      params.push(filter.active ? 1 : 0);
    }

    sql += ' ORDER BY username ASC';
    // return db.all(sql, params);
    const rows = db.all(sql, params);
    return rows.map(row => new User(row));
  },
  
  updateUser: (id, updates) => {
    const fields = [];
    const values = [];
    for (const key in updates) {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
    values.push(id);
    const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
    db.run(sql, values);
    return userDAL.getUserById(id);
  },

  // Soft delete: set active = 0
  deactivateUser: (id) => {
    db.run(`UPDATE users SET active = 0 WHERE id = ?`, [id]);
  },

  // Reactivate: set active = 1
  activateUser: (id) => {
    db.run(`UPDATE users SET active = 1 WHERE id = ?`, [id]);
  },

  // Optional: Hard delete (use with caution)
  deleteUser: (id) => {
    db.run(`DELETE FROM users WHERE id = ?`, [id]);
  }
};

module.exports = userDAL;