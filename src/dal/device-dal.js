const db = require('../../db/db');
const Device = require('../models/Device');

const deviceDAL = {
  createDevice: async (data) => {
    const { userId, name, type = null, pushSubscription = null, mqttTopic = null, ipAddress = null } = data;
    const now = new Date().toISOString();
    const res = await db.run(
      `INSERT INTO devices (userId, name, type, push_subscription, mqtt_topic, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, name, type, pushSubscription, mqttTopic, ipAddress, now]
    );
    return { ...data, id: res.lastID, createdAt: now };
  },

  getDeviceById: async (id) => {
    const row = await db.get(`SELECT * FROM devices WHERE id = ?`, [id]);
    return row ? new Device(row) : null;
  },

  listDevicesByUser: async (userId) => {
    const rows = await db.all(`SELECT * FROM devices WHERE userId = ?`, [userId]);
    return rows.map(row => new Device(row));
  },

  listAllDevices: async () => {
    const rows = await db.all(`SELECT * FROM devices`);
    return rows.map(row => new Device(row));
  },

  updateDevice: async (id, updates) => {
    const fields = [];
    const values = [];
    for (const key in updates) {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
    values.push(id);
    const sql = `UPDATE devices SET ${fields.join(', ')} WHERE id = ?`;
    await db.run(sql, values);
    return deviceDAL.getDeviceById(id);
  },

  deleteDevice: async (id) => {
    await db.run(`DELETE FROM devices WHERE id = ?`, [id]);
  }
};

module.exports = deviceDAL;