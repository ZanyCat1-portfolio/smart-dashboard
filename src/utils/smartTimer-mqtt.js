// /src/utils/smartTimer-mqtt.js

const mqtt = require('mqtt');
const { logMqtt, logError } = require('./logger');

// If you already have a singleton/shared mqttClient, require/import it instead of reconnecting.
// Example: const mqttClient = require('../path/to/mqttClient');
// Otherwise, initialize here (not recommended for production multi-usage).
// For now, let's assume mqttClient is initialized in proxy-server and you will pass it in.

function publishSmartTimerState(mqttClient, timer) {
  if (!mqttClient || !timer || !timer.id) return;
  const topic = `smarthome/smarttimer/${timer.id}/set`;
  mqttClient.publish(topic, JSON.stringify(timer));
  logMqtt(`Published SmartTimer state for timer ${timer.id}`, timer);
}

function subscribeSmartTimerTopics(mqttClient, io, smartTimerDAL) {
  if (!mqttClient) return;

  mqttClient.subscribe('smarthome/smarttimer/+/command', (err) => {
    if (err) logError('Failed to subscribe to SmartTimer command topics:', err);
  });

  mqttClient.on('message', (topic, payload) => {
    if (!topic.startsWith('smarthome/smarttimer/')) return;

    const parts = topic.split('/');
    if (parts.length !== 4 || parts[3] !== 'command') return;

    const timerId = parts[2];
    let payloadObj = {};
    try { payloadObj = JSON.parse(payload.toString()); } catch {}

    // Example supported commands: { action: 'start', duration: 600 }
    if (payloadObj.action) {
      let updated = null;
      switch (payloadObj.action) {
        case 'start':
          if (payloadObj.duration) {
            updated = smartTimerDAL.startTimer(timerId, payloadObj.duration);
            io.emit('smart-timer-update', { ...updated });
          }
          break;
        case 'cancel':
          updated = smartTimerDAL.cancelTimer(timerId);
          io.emit('smart-timer-update', { ...updated });
          break;
        case 'pause':
          updated = smartTimerDAL.pauseTimer(timerId);
          io.emit('smart-timer-update', { ...updated });
          break;
        // Add more actions if needed
      }
      // Optionally publish new state back to MQTT
      if (updated) publishSmartTimerState(mqttClient, updated);
    }
  });
}

module.exports = {
  publishSmartTimerState,
  subscribeSmartTimerTopics,
};
