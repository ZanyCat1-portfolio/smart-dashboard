const db = require('../../db/db');
const User = require('../models/User');

const userDAL = {
  createUser: async (data) => {
    const { username, email = null, active = true } = data;
    const now = new Date().toISOString();
    const res = await db.run(
      `INSERT INTO users (username, email, created_at, active)
       VALUES (?, ?, ?, ?)`,
      [username, email, now, active ? 1 : 0]
    );
    return { ...data, id: res.lastID, createdAt: now };
  },

  getUserById: async (id) => {
    const row = await db.get(`SELECT * FROM users WHERE id = ?`, [id]);
    return row ? new User(row) : null;
  },

  getUserByUsername: async (username) => {
    const row = await db.get(`SELECT * FROM users WHERE username = ?`, [username]);
    return row ? new User(row) : null;
  },

  // if no argument, lists all users. Otherwise lists active = true or active = false users
  listUsers: async (filter = {}) => {
    let sql = `SELECT * FROM users`;
    const values = [];
    if ('active' in filter) {
      sql += ` WHERE active = ?`;
      values.push(filter.active ? 1 : 0);
    }
    const rows = await db.all(sql, values);
    return rows.map(row => new User(row));
  },

  updateUser: async (id, updates) => {
    const fields = [];
    const values = [];
    for (const key in updates) {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
    values.push(id);
    const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
    await db.run(sql, values);
    return userDAL.getUserById(id);
  },

  // Soft delete: set active = 0
  deactivateUser: async (id) => {
    await db.run(`UPDATE users SET active = 0 WHERE id = ?`, [id]);
  },

  // Reactivate: set active = 1
  activateUser: async (id) => {
    await db.run(`UPDATE users SET active = 1 WHERE id = ?`, [id]);
  },

  // Optional: Hard delete (use with caution)
  deleteUser: async (id) => {
    await db.run(`DELETE FROM users WHERE id = ?`, [id]);
  }
};

module.exports = userDAL;