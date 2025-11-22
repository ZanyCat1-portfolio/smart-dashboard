class Device {
  constructor(row) {
    this.id = row.id;
    this.userId = row.userId !== undefined ? row.userId : row.user_id;
    this.name = row.name;
    this.type = row.type || null;
    // Parse pushSubscription if it's a string
    this.pushSubscription =
      row.pushSubscription !== undefined
        ? row.pushSubscription
        : (row.push_subscription ? JSON.parse(row.push_subscription) : null);
    this.mqttTopic = row.mqttTopic !== undefined ? row.mqttTopic : row.mqtt_topic;
    this.ipAddress = row.ipAddress !== undefined ? row.ipAddress : row.ip_address;
    this.createdAt = row.createdAt !== undefined ? row.createdAt : row.created_at;

    // Handle active field
    if (row.active !== undefined) {
      // SQLite stores booleans as 0/1; coerce to boolean
      this.active = row.active === 1 || row.active === true || row.active === '1';
    } else {
      this.active = true; // fallback for legacy/missing
    }
  }
}
module.exports = Device;
