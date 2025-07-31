const express = require('express');
const smartTimerDAL = require('../../dal/smartTimer-dal');
const recipientDAL = require('../../dal/recipient-dal');
const SmartTimer = require('../../models/SmartTimer');
const eventBus = require('../../utils/eventBus');
const { mqttClient } = require('../../../src/mqtt/mqtt-client');
const { publishSmartTimerState } = require('../../../src/utils/smartTimer-mqtt');
const { exportHistoricTimersToCSV } = require('../../utils/export');
const { smartTimers } = require('../../data/smartTimers');
const requireAuth = require('../../middleware/auth')
// const { scheduleTimerFinish, finishTimerAndNotify, clearTimerTimeout } = require('../../utils/smartTimer-logic');

// /api/smart-timers due to proxy-server.cjs and index.js use statements
const activeTimerTimeouts = {}; // timerId: timeoutId

// ---- IN-MEMORY UTILS ----
function addOrUpdateTimer(timer) {
  smartTimers[timer.id] = timer;
}
function deleteTimer(timerId) {
  delete smartTimers[timerId];
}

// CRUD utils using in-mem first, then DAL for persistence
function getTimerById(id) {
  return smartTimers[id] || null;
}

function scheduleTimerFinish(timer) {
  clearTimerTimeout(timer.id);

  if (!timer.endTime) return;
  const msUntilEnd = new Date(timer.endTime) - Date.now();
  if (msUntilEnd <= 0) {
    finishTimerAndNotify(timer.id, true);
    return;
  }

  activeTimerTimeouts[timer.id] = setTimeout(() => {
    finishTimerAndNotify(timer.id);
  }, msUntilEnd);
}

function clearTimerTimeout(timerId) {
  if (activeTimerTimeouts[timerId]) {
    clearTimeout(activeTimerTimeouts[timerId]);
    delete activeTimerTimeouts[timerId];
  }
}

function finishTimerAndNotify(timerId, isLate = false) {
  clearTimerTimeout(timerId);
  const timer = smartTimerDAL.finishTimer(timerId);
  if (timer) {
    smartTimers[timer.id] = timer; // update in-mem store
    eventBus.emit('timer:finished', timer);
    publishSmartTimerState(mqttClient, timer);
  }
}

function createTimer({ label, description, duration }) {
  const timer = smartTimerDAL.createSmartTimer({ label, description, duration });
  addOrUpdateTimer(timer);
  return timer;
}

function updateTimer(id, updates) {
  const updated = smartTimerDAL.updateSmartTimer(id, updates);
  addOrUpdateTimer(updated);
  return updated;
}

function startTimer(id, duration) {
  const timer = getTimerById(id);
  if (!timer) return null;
  let startTime = new Date();
  let endTime = new Date(startTime.getTime() + (duration * 1000));
  let updated = updateTimer(id, {
    state: 'running',
    duration,
    start_time: startTime.toISOString(),
    end_time: endTime.toISOString()
  });
  addOrUpdateTimer(updated);
  scheduleTimerFinish(updated);
  return updated;
}

function pauseTimer(id) {
  const timer = getTimerById(id);
  if (!timer || timer.state !== 'running') return timer;
  const now = new Date();
  const end = new Date(timer.endTime).getTime();
  const remaining = Math.max(0, Math.floor((end - now) / 1000));
  const updated = updateTimer(id, {
    state: 'paused',
    duration: remaining,
    end_time: null
  });
  clearTimerTimeout(id);
  return updated;
}

function unpauseTimer(id) {
  const timer = getTimerById(id);
  if (!timer || timer.state !== 'paused') return timer;
  const now = Date.now();
  const newEndTime = new Date(now + (timer.duration * 1000)).toISOString();
  const updated = updateTimer(id, {
    state: 'running',
    end_time: newEndTime
  });
  scheduleTimerFinish(updated);
  return updated;
}

function addTimeToTimer(id, seconds) {
  const timer = getTimerById(id);
  if (!timer) return null;
  const newDuration = timer.duration + Number(seconds);
  const updated = updateTimer(id, { duration: newDuration });
  // If timer is running, recalculate end_time and reschedule
  if (updated.state === 'running' && updated.end_time) {
    let msLeft = new Date(updated.end_time) - Date.now();
    let newEnd = new Date(Date.now() + msLeft + seconds * 1000).toISOString();
    updateTimer(id, { end_time: newEnd });
    updated.end_time = newEnd;
    scheduleTimerFinish(updated);
  }
  return updated;
}

function cancelTimer(id) {
  const updated = smartTimerDAL.cancelTimer(id);
  addOrUpdateTimer(updated);
  clearTimerTimeout(id);
  return updated;
}

function finishTimer(id) {
  const updated = smartTimerDAL.finishTimer(id);
  addOrUpdateTimer(updated);
  clearTimerTimeout(id);
  return updated;
}

// Export function so you can call it from server startup if needed
module.exports = (io) => {
  const router = express.Router();

  // --- Timer Endpoints ---

  router.post('/', (req, res) => {
    const { label, description, duration } = req.body;
    if (!label || typeof label !== 'string' || !label.trim()) {
      return res.status(400).json({ error: 'Timer label required' });
    }
    if (typeof duration !== 'number' || duration < 1) {
      return res.status(400).json({ error: 'Timer duration (seconds) required' });
    }
    try {
      const timer = createTimer({ label, description, duration });
      eventBus.emit('timer:created', timer);
      res.status(201).json(timer);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/', (req, res) => {
    try {
      const { state } = req.query;
      let allTimers = Object.values(smartTimers);
      let result;
      if (state) {
        // state can be comma-separated
        const states = state.split(',');
        result = allTimers.filter(t => states.includes(t.state));
      } else {
        result = allTimers;
      }
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/export', (req, res) => {
    try {
      const before = req.query.before;
      // Use in-mem for historic timers
      const historic = Object.values(smartTimers).filter(t => t.state === 'finished' || t.state === 'canceled');
      const csv = exportHistoricTimersToCSV(
        before ? historic.filter(t => new Date(t.updatedAt) < new Date(before)) : historic
      );
      res.header('Content-Type', 'text/csv');
      res.header('Content-Disposition', `attachment; filename="historic-timers.csv"`);
      res.send(csv);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/:id', (req, res) => {
    try {
      const timer = getTimerById(req.params.id);
      if (!timer) return res.status(404).json({ error: 'Not found' });
      res.json(timer);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Start or resume timer (schedules timeout)
  router.post('/:id/start', async (req, res) => {
    try {
      const { duration } = req.body;
      let timer = getTimerById(req.params.id);

      if (!timer) return res.status(404).json({ error: 'Not found' });

      if (typeof duration === 'number' && duration > 0) {
        timer = startTimer(timer.id, duration);
      } else {
        timer = startTimer(timer.id, timer.duration);
      }

      eventBus.emit('timer:started', timer);
      publishSmartTimerState(mqttClient, timer);

      res.json(timer);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Pause timer (clears timeout)
  router.post('/:id/pause', async (req, res) => {
    try {
      let timer = getTimerById(req.params.id);
      if (!timer || timer.state !== 'running') return res.status(404).json({ error: 'Not running' });

      timer = pauseTimer(timer.id);

      eventBus.emit('timer:paused', timer);
      publishSmartTimerState(mqttClient, timer);

      res.json(timer);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/unpause', async (req, res) => {
    try {
      let timer = getTimerById(req.params.id);
      if (!timer || timer.state !== 'paused') return res.status(404).json({ error: 'Not paused' });

      timer = unpauseTimer(timer.id);

      eventBus.emit('timer:unpaused', timer);
      publishSmartTimerState(mqttClient, timer);

      res.json(timer);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Add time (updates duration/endTime, reschedules if running)
  router.post('/:id/add-time', async (req, res) => {
    try {
      const { seconds } = req.body;
      let timer = getTimerById(req.params.id);
      if (!timer) return res.status(404).json({ error: 'Not found' });

      timer = addTimeToTimer(timer.id, seconds);

      eventBus.emit('timer:addedTime', timer, Number(seconds));
      publishSmartTimerState(mqttClient, timer);

      res.json(timer);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Cancel timer (clears timeout)
  router.post('/:id/cancel', async (req, res) => {
    try {
      let timer = cancelTimer(req.params.id);

      eventBus.emit('timer:canceled', timer);
      publishSmartTimerState(mqttClient, timer);

      res.json(timer);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Finish timer (clears timeout)
  router.post('/:id/finish', async (req, res) => {
    try {
      await finishTimerAndNotify(req.params.id);
      const timer = getTimerById(req.params.id);
      res.json(timer);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Add recipient to timer
  router.post('/:id/recipients', requireAuth, async (req, res) => {
    const timerId = req.params.id;
    const { userId, deviceId, type, target } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    if (!deviceId) return res.status(400).json({ error: 'deviceId required' });
    if (!type) return res.status(400).json({ error: 'type required' });
    if (!target) return res.status(400).json({ error: 'target required' });
    const existing = recipientDAL.getRecipient(timerId, userId, deviceId, type, target);
    if (existing) {
      return res.status(409).json({ error: 'Recipient already exists for this timer/device/type/target', recipient: existing });
    }
    try {
      const recipient = recipientDAL.addRecipientToTimer(timerId, { userId, deviceId, type, target });
      eventBus.emit('recipients:updated', { timerId, recipient });
      res.status(201).json(recipient);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Remove recipient from timer
  router.delete('/:id/recipients/:recipientId', async (req, res) => {
    const timerId = req.params.id;
    const recipientId = req.params.recipientId;
    try {
      // Find recipient (optional, for extra validation)
      const recipient = recipientDAL.getRecipientById(recipientId);
      if (!recipient) {
        return res.status(404).json({ error: 'Recipient not found' });
      }
      if (String(recipient.smartTimerId || recipient.smarttimerid) !== String(timerId)) {
        return res.status(400).json({ error: 'Recipient does not belong to this timer' });
      }

      // Remove recipient
      recipientDAL.removeRecipient(recipientId);

      // Emit event to update all clients
      eventBus.emit('recipients:updated', { timerId });

      res.status(204).end();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/prune', async (req, res) => {
    try {
      const before = req.query.before;
      smartTimerDAL.pruneHistoricSmartTimers({ beforeDate: before });
      // Also prune in-mem timers
      for (const id in smartTimers) {
        const timer = smartTimers[id];
        if ((timer.state === 'finished' || timer.state === 'canceled') && (!before || new Date(timer.updatedAt) < new Date(before))) {
          deleteTimer(id);
        }
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // List recipients for timer
  router.get('/:id/recipients', async (req, res) => {
    try {
      const recipients = recipientDAL.getRecipientsForTimer(req.params.id);
      res.json(recipients);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
