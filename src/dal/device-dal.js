// pushSubscription stored as json, but I think db field wanted string. Is this going to be okay? We only needed one part of the subscription, I think its called endpoint?

const db = require('../../db/db');
const Device = require('../models/Device');

const deviceDAL = {
  createDevice: (data) => {
    const { userId, name, type = null, pushSubscription = null, mqttTopic = null, ipAddress = null } = data;
    const now = new Date().toISOString();

    // Always store pushSubscription as JSON string if present
    const pushSubString = pushSubscription ? JSON.stringify(pushSubscription) : null;

    const res = db.run(
      `INSERT INTO devices (userId, name, type, push_subscription, mqtt_topic, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, name, type, pushSubString, mqttTopic, ipAddress, now]
    );
    return { ...data, id: res.lastID, createdAt: now };
  },

  getDeviceById: (id) => {
    const row = db.get(`SELECT * FROM devices WHERE id = ?`, [id]);
    return row ? new Device(row) : null;
  },

  // Find device by push subscription endpoint
  findDeviceByEndpoint: (endpoint) => {
    // Get all devices with a push_subscription and check endpoint in JSON
    const rows = db.all(`SELECT * FROM devices WHERE push_subscription IS NOT NULL`);
    for (const row of rows) {
      try {
        const ps = JSON.parse(row.push_subscription);
        if (ps && ps.endpoint === endpoint) {
          return new Device(row);
        }
      } catch (e) {
        // Malformed push_subscription, skip
      }
    }
    return null;
  },

  listDevicesByUser: (userId) => {
    const rows = db.all(`SELECT * FROM devices WHERE userId = ?`, [userId]);
    return rows.map(row => new Device(row));
  },

  listAllDevices: () => {
    const rows = db.all(`SELECT * FROM devices`);
    return rows.map(row => new Device(row));
  },

  updateDevice: (id, updates) => {
    const fields = [];
    const values = [];
    for (const key in updates) {
      if (key === 'pushSubscription') {
        fields.push(`push_subscription = ?`);
        values.push(JSON.stringify(updates[key]));
      } else {
        fields.push(`${key} = ?`);
        values.push(updates[key]);
      }
    }
    values.push(id);
    const sql = `UPDATE devices SET ${fields.join(', ')} WHERE id = ?`;
    db.run(sql, values);
    return deviceDAL.getDeviceById(id);
  },

  deleteDevice: (id) => {
    db.run(`DELETE FROM devices WHERE id = ?`, [id]);
  }
};

module.exports = deviceDAL;
