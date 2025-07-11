const EventEmitter = require('events');

class SmartTimer extends EventEmitter {
  constructor({
    id = null,
    label,
    duration,
    state = 'pending',
    startTime = null,
    endTime = null,
    createdAt = null,
    updatedAt = null,
    recipients = []
  }) {
    super();
    this.id = id;
    this.label = label;
    this.duration = duration; // in seconds
    this.state = state;       // 'pending', 'running', 'paused', 'canceled', 'finished'
    this.startTime = startTime;
    this.endTime = endTime;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.recipients = recipients; // Array of Recipient objects or IDs
    this.remaining = duration; // Track remaining time (optional, can recalc from startTime)
  }

  start() {
    if (this.state !== 'pending' && this.state !== 'paused') return false;
    this.state = 'running';
    this.startTime = new Date().toISOString();
    this.emit('started', this);
    return true;
  }

  pause() {
    if (this.state !== 'running') return false;
    this.state = 'paused';
    this.emit('paused', this);
    return true;
  }

  addTime(seconds) {
    if (typeof seconds !== 'number' || seconds <= 0) return false;
    this.duration += seconds;
    this.emit('addedTime', this, seconds);
    return true;
  }

  cancel() {
    if (this.state === 'canceled' || this.state === 'finished') return false;
    this.state = 'canceled';
    this.endTime = new Date().toISOString();
    this.emit('canceled', this);
    return true;
  }

  finish() {
    if (this.state === 'finished' || this.state === 'canceled') return false;
    this.state = 'finished';
    this.endTime = new Date().toISOString();
    this.emit('finished', this);
    return true;
  }

  // Example: duration as formatted string (HH:MM:SS)
  getDurationString() {
    const sec = this.duration % 60;
    const min = Math.floor(this.duration / 60) % 60;
    const hr = Math.floor(this.duration / 3600);
    return [hr, min, sec]
      .map(x => x.toString().padStart(2, '0'))
      .join(':');
  }
}

module.exports = SmartTimer;