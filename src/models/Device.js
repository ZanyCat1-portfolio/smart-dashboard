class Device {
  constructor({
    id = null,
    userId,
    name,
    type = null,           // e.g., 'phone', 'tablet', 'computer'
    pushSubscription = null,
    mqttTopic = null,
    ipAddress = null,
    createdAt = null
  }) {
    this.id = id;
    this.userId = userId;
    this.name = name;
    this.type = type;
    this.pushSubscription = pushSubscription;
    this.mqttTopic = mqttTopic;
    this.ipAddress = ipAddress;
    this.createdAt = createdAt;
  }
}

module.exports = Device;