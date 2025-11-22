//  # MQTT client setup, publish/subscribe handlers
const mqtt = require('mqtt')

const MQTT_URL = process.env.MQTT_URL || 'mqtt://localhost:1883';

const mqttClient = mqtt.connect(MQTT_URL, {
  username: process.env.MQTT_USER,
  password: process.env.MQTT_PASS,
});
module.exports = mqttClient;