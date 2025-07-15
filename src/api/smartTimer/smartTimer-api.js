const express = require('express');
const smartTimerDAL = require('../../dal/smartTimer-dal');
const recipientDAL = require('../../dal/recipient-dal');
const SmartTimer = require('../../models/SmartTimer');
const eventBus = require('../../utils/eventBus');
const { mqttClient } = require('../../../proxy-server.cjs');
const { publishSmartTimerState } = require('../../../src/utils/smartTimer-mqtt');
const { exportHistoricTimersToCSV } = require('../../utils/export');
const { sendPushToRecipients } = require('../../../src/notifications/push');

const activeTimerTimeouts = {}; // timerId: timeoutId

// ----- Timeout Helpers -----
function scheduleTimerFinish(timer) {
  // Clear any existing timeout first
  clearTimerTimeout(timer.id);

  if (!timer.endTime) return;
  const msUntilEnd = new Date(timer.endTime) - Date.now();
  if (msUntilEnd <= 0) {
    // Already overdue: finish immediately and notify
    finishTimerAndNotify(timer.id, true); // true = notify late
    return;
  }

  // Schedule finish
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

// Call when timer finishes (timeout or manual)
async function finishTimerAndNotify(timerId, isLate = false) {
  clearTimerTimeout(timerId);
  const timer = smartTimerDAL.finishTimer(timerId); // marks as finished
  if (timer) {
    eventBus.emit('timer:finished', timer);
    publishSmartTimerState(mqttClient, timer);
    const recipients = recipientDAL.getRecipientsForTimer(timer.id);
    const payload = { type: 'timerFinished', timer, isLate };
    await sendPushToRecipients(recipients, payload);
  }
}

// Rehydrate timers on server start
function rehydrateRunningTimersOnStartup() {
  const runningTimers = smartTimerDAL.listSmartTimersByState('running');
  runningTimers.forEach(timer => {
    const msUntilEnd = new Date(timer.endTime) - Date.now();
    if (msUntilEnd > 0) {
      scheduleTimerFinish(timer);
    } else {
      finishTimerAndNotify(timer.id, true); // Mark late timers as finished immediately
    }
  });
}

// Export function so you can call it from server startup if needed
module.exports = (io) => {
  const router = express.Router();

  // --- Timer Endpoints ---

  router.post('/', (req, res) => {
    const { label, duration } = req.body;
    if (!label || typeof label !== 'string' || !label.trim()) {
      return res.status(400).json({ error: 'Timer label required' });
    }
    if (typeof duration !== 'number' || duration < 1) {
      return res.status(400).json({ error: 'Timer duration (seconds) required' });
    }
    try {
      const timer = smartTimerDAL.createSmartTimer({ label, duration });
      res.status(201).json(timer);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/', (req, res) => {
    try {
      const { state } = req.query;
      let timers;
      if (state) {
        timers = smartTimerDAL.listSmartTimersByState(state);
      } else {
        timers = smartTimerDAL.listAllSmartTimers();
      }
      res.json(timers);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/export', (req, res) => {
    try {
      const before = req.query.before;
      const csv = exportHistoricTimersToCSV(
        before ? smartTimerDAL.listHistoricSmartTimers({ before }) : smartTimerDAL.listHistoricSmartTimers()
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
      const timer = smartTimerDAL.getSmartTimerById(req.params.id);
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
      let timer = smartTimerDAL.getSmartTimerById(req.params.id);

      if (!timer) return res.status(404).json({ error: 'Not found' });

      if (typeof duration === 'number' && duration > 0) {
        timer = smartTimerDAL.startTimer(timer.id, duration);
      } else {
        timer = smartTimerDAL.startTimer(timer.id, timer.duration);
      }

      // Schedule finish timeout
      scheduleTimerFinish(timer);

      eventBus.emit('timer:started', timer);
      publishSmartTimerState(mqttClient, timer);

      const recipients = recipientDAL.getRecipientsForTimer(timer.id);
      const payload = { type: 'timerStarted', timer };
      await sendPushToRecipients(recipients, payload);

      res.json(timer);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Pause timer (clears timeout)
  router.post('/:id/pause', async (req, res) => {
    try {
      let timer = smartTimerDAL.getSmartTimerById(req.params.id);
      if (!timer || timer.state !== 'running') return res.status(404).json({ error: 'Not running' });

      // Calculate remaining time
      const now = Date.now();
      const end = new Date(timer.endTime).getTime();
      const remaining = Math.max(0, Math.round((end - now) / 1000));
      timer = smartTimerDAL.updateSmartTimer(timer.id, {
        state: 'paused',
        duration: remaining,
        end_time: null
      });
      clearTimerTimeout(timer.id);

      eventBus.emit('timer:paused', timer);
      publishSmartTimerState(mqttClient, timer);

      const recipients = recipientDAL.getRecipientsForTimer(timer.id);
      const payload = { type: 'timerPaused', timer };
      await sendPushToRecipients(recipients, payload);

      res.json(timer);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Add time (updates duration/endTime, reschedules if running)
  router.post('/:id/add-time', async (req, res) => {
    try {
      const { seconds } = req.body;
      let timer = smartTimerDAL.getSmartTimerById(req.params.id);
      if (!timer) return res.status(404).json({ error: 'Not found' });

      // Update duration
      timer = smartTimerDAL.updateSmartTimer(timer.id, { duration: timer.duration + Number(seconds) });

      // If timer is running, reschedule finish
      if (timer.state === 'running') {
        scheduleTimerFinish(timer);
      }

      eventBus.emit('timer:addedTime', timer, Number(seconds));
      publishSmartTimerState(mqttClient, timer);

      const recipients = recipientDAL.getRecipientsForTimer(timer.id);
      const payload = { type: 'timerAddedTime', timer, seconds: Number(seconds) };
      await sendPushToRecipients(recipients, payload);

      res.json(timer);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Cancel timer (clears timeout)
  router.post('/:id/cancel', async (req, res) => {
    try {
      let timer = smartTimerDAL.cancelTimer(req.params.id);
      clearTimerTimeout(timer.id);

      eventBus.emit('timer:canceled', timer);
      publishSmartTimerState(mqttClient, timer);
      const recipients = recipientDAL.getRecipientsForTimer(timer.id);
      const payload = { type: 'timerCanceled', timer };
      await sendPushToRecipients(recipients, payload);

      res.json(timer);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Finish timer (clears timeout)
  router.post('/:id/finish', async (req, res) => {
    try {
      await finishTimerAndNotify(req.params.id);
      const timer = smartTimerDAL.getSmartTimerById(req.params.id);
      res.json(timer);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Add recipient to timer
  router.post('/:id/recipients', async (req, res) => {
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
      res.status(201).json(recipient);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Remove recipient from timer
  router.delete('/:id/recipients/:recipientId', async (req, res) => {
    try {
      recipientDAL.removeRecipient(req.params.recipientId);
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/prune', async (req, res) => {
    try {
      const before = req.query.before;
      smartTimerDAL.pruneHistoricSmartTimers({ beforeDate: before });
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

  // ---- Rehydrate timers on API module load ----
  rehydrateRunningTimersOnStartup();

  return router;
}
