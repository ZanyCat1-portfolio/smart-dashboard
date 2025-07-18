const db = require('../../db/db');
const Recipient = require('../models/Recipient');

const recipientDAL = {
  addRecipientToTimer: (timerId, recipientData) => {
    const { deviceId = null, userId = null, type, target } = recipientData;
    if (!type || !target) {
      throw new Error('Recipient type and target are required.');
    }
    if (!userId || !deviceId) {
      throw new Error('Recipient userId and deviceId are required.');
    }

    // Enforce uniqueness: only one recipient per combo
    const existing = recipientDAL.getRecipient(timerId, userId, deviceId, type, target);
    if (existing) {
      throw new Error('Recipient already exists for this timer/device/type/target');
    }

    const now = new Date().toISOString();
    const res = db.run(
      `INSERT INTO recipients (smartTimerId, deviceId, userId, type, target, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [timerId, deviceId, userId, type, target, now]
    );
    return { ...recipientData, id: res.lastInsertRowid, smartTimerId: timerId, createdAt: now };
  },

  // Get all recipients for a timer
  getRecipientsForTimer: (timerId) => {
    const rows = db.all(`SELECT * FROM recipients WHERE smartTimerId = ?`, [timerId]);
    return rows.map(row => new Recipient(row));
  },

  getRecipientById: (id) => {
    const row = db.get(`SELECT * FROM recipients WHERE id = ?`, [id]);
    return row ? new Recipient(row) : null;
  },

  // Get unique recipient by all keys
  getRecipient: (timerId, userId, deviceId, type, target) => {
    const row = db.get(
      `SELECT * FROM recipients WHERE smartTimerId = ? AND userId = ? AND deviceId = ? AND type = ? AND target = ?`,
      [timerId, userId, deviceId, type, target]
    );
    return row ? new Recipient(row) : null;
  },

  listRecipientsByUser: (userId) => {
    const rows = db.all(`SELECT * FROM recipients WHERE userId = ?`, [userId]);
    return rows.map(row => new Recipient(row));
  },

  listRecipientsByDevice: (deviceId) => {
    const rows = db.all(`SELECT * FROM recipients WHERE deviceId = ?`, [deviceId]);
    return rows.map(row => new Recipient(row));
  },

  removeRecipient: (id) => {
    db.run(`DELETE FROM recipients WHERE id = ?`, [id]);
  }
};

module.exports = recipientDAL;
