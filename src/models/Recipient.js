class Recipient {
  constructor({
    id = null,
    smartTimerId,
    deviceId = null,
    userId = null,
    type,           // 'push', 'mqtt', 'ip', etc.
    target = null,  // e.g., push subscription, MQTT topic, or IP address
    createdAt = null
  }) {
    this.id = id;
    this.smartTimerId = smartTimerId;
    this.deviceId = deviceId;
    this.userId = userId;
    this.type = type;
    this.target = target;
    this.createdAt = createdAt;
  }
}

module.exports = Recipient;