const db = require('../../db/db');
const Recipient = require('../models/Recipient');

const recipientDAL = {
  addRecipientToTimer: async (timerId, recipientData) => {
    const { deviceId = null, userId = null, type, target = null } = recipientData;
    const now = new Date().toISOString();
    const res = await db.run(
      `INSERT INTO recipients (smartTimerId, deviceId, userId, type, target, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [timerId, deviceId, userId, type, target, now]
    );
    return { ...recipientData, id: res.lastID, smartTimerId: timerId, createdAt: now };
  },

  getRecipientsForTimer: async (timerId) => {
    const rows = await db.all(`SELECT * FROM recipients WHERE smartTimerId = ?`, [timerId]);
    return rows.map(row => new Recipient(row));
  },

  getRecipientById: async (id) => {
    const row = await db.get(`SELECT * FROM recipients WHERE id = ?`, [id]);
    return row ? new Recipient(row) : null;
  },

  listRecipientsByUser: async (userId) => {
    const rows = await db.all(`SELECT * FROM recipients WHERE userId = ?`, [userId]);
    return rows.map(row => new Recipient(row));
  },

  listRecipientsByDevice: async (deviceId) => {
    const rows = await db.all(`SELECT * FROM recipients WHERE deviceId = ?`, [deviceId]);
    return rows.map(row => new Recipient(row));
  },

  removeRecipient: async (id) => {
    await db.run(`DELETE FROM recipients WHERE id = ?`, [id]);
  }
};

module.exports = recipientDAL;