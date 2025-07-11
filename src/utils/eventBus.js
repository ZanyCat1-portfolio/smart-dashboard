const EventEmitter = require('events');

// Create a singleton EventBus for app-wide event broadcasting and listening
const eventBus = new EventEmitter();

// (Optional) Set max listeners to avoid warning if many modules subscribe
eventBus.setMaxListeners(50);

module.exports = eventBus;