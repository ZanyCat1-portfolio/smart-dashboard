function timestamp() {
  return new Date().toISOString();
}

function logInfo(...args) {
  console.log(`[INFO] [${timestamp()}]`, ...args);
}

function logError(...args) {
  console.error(`[ERROR] [${timestamp()}]`, ...args);
}

function logMqtt(...args) {
  console.log(`[MQTT] [${timestamp()}]`, ...args);
}

module.exports = {
  logInfo,
  logError,
  logMqtt,
};
