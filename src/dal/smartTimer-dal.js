const db = require('../../db/db');
const SmartTimer = require('../models/SmartTimer');

const smartTimerDAL = {
  createSmartTimer: async (data) => {
    const { label, duration, state = 'pending', startTime, endTime } = data;
    const now = new Date().toISOString();
    const res = db.run(
      `INSERT INTO smartTimers (label, duration, state, start_time, end_time, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [label, duration, state, startTime, endTime, now, now]
    );
    return { ...data, id: res.lastID, createdAt: now, updatedAt: now };
  },

  getSmartTimerById: async (id) => {
    const row = db.get(`SELECT * FROM smartTimers WHERE id = ?`, [id]);
    return row ? new SmartTimer(row) : null;
  },

  listSmartTimersByState: async (state) => {
    const rows = db.all(`SELECT * FROM smartTimers WHERE state = ?`, [state]);
    return rows.map(row => new SmartTimer(row));
  },

  listAllSmartTimers: async () => {
    const rows = db.all(`SELECT * FROM smartTimers`);
    return rows.map(row => new SmartTimer(row));
  },

  updateSmartTimer: async (id, updates) => {
    const fields = [];
    const values = [];
    for (const key in updates) {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
    values.push(new Date().toISOString()); // updated_at
    values.push(id);
    const sql = `UPDATE smartTimers SET ${fields.join(', ')}, updated_at = ? WHERE id = ?`;
    db.run(sql, values);
    return smartTimerDAL.getSmartTimerById(id);
  },

  setState: async (id, state) => {
    const now = new Date().toISOString();
    db.run(
      `UPDATE smartTimers SET state = ?, updated_at = ? WHERE id = ?`,
      [state, now, id]
    );
    return smartTimerDAL.getSmartTimerById(id);
  },

  setStartTime: async (id, startTime) => {
    const now = new Date().toISOString();
    db.run(
      `UPDATE smartTimers SET start_time = ?, updated_at = ? WHERE id = ?`,
      [startTime, now, id]
    );
    return smartTimerDAL.getSmartTimerById(id);
  },

  setEndTime: async (id, endTime) => {
    const now = new Date().toISOString();
    db.run(
      `UPDATE smartTimers SET end_time = ?, updated_at = ? WHERE id = ?`,
      [endTime, now, id]
    );
    return smartTimerDAL.getSmartTimerById(id);
  },

  deleteSmartTimer: async (id) => {
    db.run(`DELETE FROM smartTimers WHERE id = ?`, [id]);
  }
};

module.exports = smartTimerDAL;