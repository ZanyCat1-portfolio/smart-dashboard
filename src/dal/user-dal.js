const db = require('../../db/db');
const User = require('../models/User');

const userDAL = {
  createUser: ({ username, email }) => {
    const now = new Date().toISOString();
    const res = db.run(
      `INSERT INTO users (username, email, active, created_at)
       VALUES (?, ?, 1, ?)`,
      username, email || null, now
    );
    return {
      id: res.lastInsertRowid,
      username,
      email: email || null,
      active: true,
      createdAt: now,
    };
  },

  getUserById: (id) => {
    const row = db.get(`SELECT * FROM users WHERE id = ?`, [id]);
    return row ? new User(row) : null;
  },

  getUserByUsername: (username) => {
    return db.get('SELECT * FROM users WHERE username = ?', [username]);
  },

  getUserByEmail: (email) => {
    return db.get('SELECT * FROM users WHERE email = ?', [email]);
  },

  findUsersByName: (username) => {
    return db.all(`
      SELECT * FROM users
      WHERE username LIKE '%' || ? || '%'
      ORDER BY username ASC
    `, [username]);
  },

  findUsersByExactUsername: (username) => {
    return db.all(`
      SELECT * FROM users WHERE LOWER(username) = LOWER(?)
    `, [username]);
  },

  listUsers: (filter = {}) => {
    let sql = 'SELECT * FROM users';
    const params = [];

    if (typeof filter.active === 'boolean') {
      sql += ' WHERE active = ?';
      params.push(filter.active ? 1 : 0);
    }

    sql += ' ORDER BY username ASC';
    return db.all(sql, params);
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