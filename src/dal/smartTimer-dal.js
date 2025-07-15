const db = require('../../db/db');
const SmartTimer = require('../models/SmartTimer');

const smartTimerDAL = {

  createSmartTimer: (data) => {
    const { label, duration, state = 'pending', startTime, endTime } = data;
    const now = new Date().toISOString();
    const safeStartTime = startTime || null;
    const safeEndTime = endTime || null;

    const res = db.run(
      `INSERT INTO smartTimers (label, duration, initial_duration, state, start_time, end_time, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [label, duration, duration, state, safeStartTime, safeEndTime, now, now]
    );
    return { ...data, id: res.lastID, createdAt: now, updatedAt: now };
  },

  getSmartTimerById: (id) => {
    const row = db.get(`SELECT * FROM smartTimers WHERE id = ?`, [id]);
    return row ? new SmartTimer(row) : null;
  },

  listSmartTimersByState: (states) => {
    let rows;
    if (Array.isArray(states)) {
      const placeholders = states.map(() => '?').join(',');
      rows = db.all(`SELECT * FROM smartTimers WHERE state IN (${placeholders})`, states);
    } else {
      rows = db.all(`SELECT * FROM smartTimers WHERE state = ?`, [states]);
    }
    return rows.map(row => new SmartTimer(row));
  },

  getCurrentActiveSmartTimers: () => {
    return smartTimerDAL.listSmartTimersByState(['running', 'pending', 'paused']);
  },

  listHistoricSmartTimers: () => {
    return smartTimerDAL.listSmartTimersByState(['finished', 'canceled']);
  },

  listAllSmartTimers: () => {
    const rows = db.all(`SELECT * FROM smartTimers`);
    return rows.map(row => new SmartTimer(row));
  },

  updateSmartTimer: (id, updates) => {
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

  setState: (id, state) => {
    const now = new Date().toISOString();
    db.run(
      `UPDATE smartTimers SET state = ?, updated_at = ? WHERE id = ?`,
      [state, now, id]
    );
    return smartTimerDAL.getSmartTimerById(id);
  },

  setStartTime: (id, startTime) => {
    const now = new Date().toISOString();
    db.run(
      `UPDATE smartTimers SET start_time = ?, updated_at = ? WHERE id = ?`,
      [startTime, now, id]
    );
    return smartTimerDAL.getSmartTimerById(id);
  },

  setEndTime: (id, endTime) => {
    const now = new Date().toISOString();
    db.run(
      `UPDATE smartTimers SET end_time = ?, updated_at = ? WHERE id = ?`,
      [endTime, now, id]
    );
    return smartTimerDAL.getSmartTimerById(id);
  },

  deleteSmartTimer: (id) => {
    db.run(`DELETE FROM smartTimers WHERE id = ?`, [id]);
  },

  pruneHistoricTimers: ({ beforeDate } = {}) => {
    if (beforeDate) {
      db.run(
        `DELETE FROM smartTimers WHERE (state = 'finished' OR state = 'canceled') AND updated_at < ?`,
        [beforeDate]
      );
    } else {
      db.run(`DELETE FROM smartTimers WHERE state = 'finished' OR state = 'canceled'`);
    }
  },

  startTimer: (id, duration) => {
    const now = new Date();
    const startTime = now.toISOString();
    const endTime = new Date(now.getTime() + duration * 1000).toISOString();
    smartTimerDAL.updateSmartTimer(id, {
      state: 'running',
      duration,
      start_time: startTime,
      end_time: endTime
    });
    return smartTimerDAL.getSmartTimerById(id);
  },

  cancelTimer: (id) => {
    const now = new Date().toISOString();
    smartTimerDAL.updateSmartTimer(id, {
      state: 'canceled',
      end_time: now
    });
    return smartTimerDAL.getSmartTimerById(id);
  },

  finishTimer: (id) => {
    const now = new Date().toISOString();
    smartTimerDAL.updateSmartTimer(id, {
      state: 'finished',
      end_time: now
    });
    return smartTimerDAL.getSmartTimerById(id);
  },

  pauseTimer: (id) => {
    const timer = smartTimerDAL.getSmartTimerById(id);
    if (!timer || timer.state !== 'running') return timer;

    const now = new Date();
    const remaining = Math.max(0, Math.floor((new Date(timer.end_time) - now) / 1000));
    smartTimerDAL.updateSmartTimer(id, {
      state: 'paused',
      duration: remaining,
      end_time: null
    });
    return smartTimerDAL.getSmartTimerById(id);
  },
};

module.exports = smartTimerDAL;
