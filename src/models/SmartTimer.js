const EventEmitter = require('events');

class SmartTimer extends EventEmitter {
  constructor(row) {
    super();
    this.id = row.id;
    this.label = row.label;
    this.duration = row.duration;
    this.state = row.state || 'pending';
    this.startTime = row.startTime !== undefined ? row.startTime : row.start_time;
    this.endTime = row.endTime !== undefined ? row.endTime : row.end_time;
    this.createdAt = row.createdAt !== undefined ? row.createdAt : row.created_at;
    this.updatedAt = row.updatedAt !== undefined ? row.updatedAt : row.updated_at;
    this.recipients = row.recipients || [];
    this.remaining = this.duration; // Or recalc if you store in DB
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