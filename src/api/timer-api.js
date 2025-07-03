const express = require('express');
// const { sendPushNotification } = require('./push');

// In-memory storage (replace with DB for production)
let nextTimerId = 1;
const timers = {};          // { id: timerObj }
const timerHistory = [];    // [{...}]

// Timer structure: { id, name, minutes, inputMinutes, running, remaining, endTime, created, lastAction, recipients }

function nowMs() { return Date.now(); }

function serializeTimer(timer) {
  // Remove the .timeout property for safe JSON
  const { timeout, ...safe } = timer;
  return safe;
}

const { contacts } = require('./contacts-api'); // or wherever your contacts live
const webpush = require('web-push');

// --- REMOVE DEVICE FROM ALL TIMER RECIPIENTS ---
function removeDeviceFromRecipients(deviceId) {
  for (const timerId in timers) {
    const timer = timers[timerId];
    if (Array.isArray(timer.recipients)) {
      // Remove the device from each recipient.devices array
      let changed = false;
      timer.recipients = timer.recipients.map(recipient => {
        if (!recipient || !recipient.devices) return recipient;
        const before = recipient.devices.length;
        recipient.devices = recipient.devices.filter(device => String(device.id) !== String(deviceId));
        if (recipient.devices.length !== before) changed = true;
        return recipient;
      }).filter(recipient => recipient.devices && recipient.devices.length > 0);
      if (changed) {
        console.log(`[Recipients] Removed device ${deviceId} from timer ${timerId}`);
      }
    }
  }
}

async function notifyRecipients(timer, message) {
  // ...same as before...
  console.log('[NOTIFY]', { timer, message });

  if (!Array.isArray(timer.recipients)) return;

  // Filter to only valid recipient objects
  const validRecipients = timer.recipients.filter(recipient =>
    recipient && typeof recipient.contactId !== 'undefined' && Array.isArray(recipient.devices)
  );

  if (validRecipients.length !== timer.recipients.length) {
    console.warn(
      '[NOTIFY] Some recipients are invalid and will be skipped:',
      timer.recipients.filter(recipient => !recipient || typeof recipient.contactId === 'undefined')
    );
  }

  for (const recipient of validRecipients) {
    console.log("[NOTIFY] Processing recipient:", recipient);
    const contact = contacts[recipient.contactId];
    if (!contact) {
      console.warn('[NOTIFY] No contact found for contactId:', recipient.contactId);
      continue;
    }
    const deviceList = recipient.devices.length
      ? contact.devices.filter(device => recipient.devices.some(recDevice => String(recDevice.id) === String(device.id)))
      : contact.devices;
    for (const device of deviceList) {
      if (!device.subscription) continue;
      try {
        await webpush.sendNotification(device.subscription, JSON.stringify({
          title: timer.name || 'Timer Alert Changed',
          body: message,
          timerId: timer.id,
          deviceName: device.name || '',
        }));
        console.log(`Push sent to ${contact.name} [${device.name}]`);
      } catch (err) {
        console.error('Push error:', err);
      }
    }
  }
}

function mergeRecipients(oldRecipients = [], newRecipients = []) {
  const merged = {};

  for (const recipient of oldRecipients.concat(newRecipients)) {
    if (!recipient || !recipient.contactId) continue;
    if (!merged[recipient.contactId]) {
      merged[recipient.contactId] = {
        ...recipient,
        devices: Array.isArray(recipient.devices) ? [...recipient.devices] : [],
      };
    } else {
      const existingDevices = merged[recipient.contactId].devices || [];
      const incomingDevices = Array.isArray(recipient.devices) ? recipient.devices : [];
      const allDevices = [...existingDevices, ...incomingDevices];
      merged[recipient.contactId].devices = allDevices.filter(
        (device, deviceIndex, deviceArr) => device && device.id && deviceArr.findIndex(d => d.id === device.id) === deviceIndex
      );
    }
  }

  return Object.values(merged);
}

const api = (io) => {
  const router = express.Router();

  function scheduleTimer(timer) {
    if (timer.timeout) clearTimeout(timer.timeout);
    if (!timer.running || timer.remaining <= 0) return;

    const ms = timer.endTime - nowMs();
    timer.timeout = setTimeout(() => {
      // Move to history
      timer.running = false;
      timer.remaining = 0;
      timer.completed = true;
      timer.lastAction = new Date();
      // when timer lapses naturally
      notifyRecipients(timer, `Timer "${timer.name}" completed!`);
      timerHistory.push({ ...timer });
      delete timers[timer.id];
      io.emit('dashboard-timer-removed', { id: timer.id });
    }, ms);
  }

  // --- REST API ROUTES (unchanged except recipients logic above) ---
  router.post('/', (req, res) => {
    const { name, minutes, recipients = [] } = req.body;
    if (!name || !minutes || isNaN(minutes) || minutes < 1) {
      return res.status(400).json({ error: 'Invalid name or minutes' });
    }
    const timerId = String(nextTimerId++);
    const created = new Date();
    const timer = {
      id: timerId,
      name,
      minutes,
      inputMinutes: minutes, // NEW: keep track of form entry, for pre-start value
      running: false,
      remaining: minutes * 60, // seconds
      endTime: null,
      created,
      lastAction: created,
      recipients: Array.isArray(recipients) ? recipients : [],
    };
    timers[timerId] = timer;
    io.emit('dashboard-timer-created', serializeTimer(timer));
    res.json(serializeTimer(timer));
  });

  router.get('/', (req, res) => {
    res.json(Object.values(timers).map(serializeTimer));
  });

  router.get('/history', (req, res) => {
    res.json(timerHistory.map(serializeTimer));
  });

  router.get('/:id', (req, res) => {
    const timer = timers[req.params.id];
    if (!timer) return res.status(404).json({ error: 'Not found' });
    res.json(serializeTimer(timer));
  });

  router.post('/:id/start', async (req, res) => {
    const timer = timers[req.params.id];
    const minutes = parseInt(req.body.minutes, 10);
    if (!timer) return res.status(404).json({ error: 'Not found' });
    if (isNaN(minutes) || minutes < 1) return res.status(400).json({ error: 'Invalid minutes' });

    const now = nowMs();
    timer.inputMinutes = null;
    if (!timer.running) {
      timer.running = true;
      timer.endTime = now + minutes * 60 * 1000;
      timer.remaining = minutes * 60;
    } else {
      timer.endTime += minutes * 60 * 1000;
      timer.remaining = Math.round((timer.endTime - now) / 1000);
    }
    timer.lastAction = new Date();
    scheduleTimer(timer);
    io.emit('dashboard-timer-updated', {
      ...serializeTimer(timer),
      remaining: timer.remaining,
      action: 'updated'
    });

    res.json({ success: true, timer: serializeTimer(timer) });

    try {
      await notifyRecipients(timer, `Timer "${timer.name}" started for ${minutes} minute${minutes !== 1 ? 's' : ''}.`);
    } catch (err) {
      console.error('Error notifying recipients:', err);
    }
  });

  router.post('/:id/cancel', async (req, res) => {
    const timer = timers[req.params.id];
    if (!timer) return res.status(404).json({ error: 'Not found' });
    if (timer.timeout) clearTimeout(timer.timeout);
    timer.running = false;
    timer.remaining = 0;
    timer.completed = false;
    timer.lastAction = new Date();
    timerHistory.push({ ...serializeTimer(timer), canceled: true });
    delete timers[timer.id];
    io.emit('dashboard-timer-removed', { id: timer.id, action: 'canceled' });
    res.json({ success: true });

    try {
      await notifyRecipients(timer, `Timer "${timer.name}" was canceled.`);
    } catch (err) {
      console.error('Error notifying recipients:', err);
    }
  });

  router.get('/:id/status', (req, res) => {
    const timer = timers[req.params.id];
    if (!timer) return res.status(404).json({ error: 'Not found' });
    const now = nowMs();
    let remaining = timer.running && timer.endTime ? Math.max(0, Math.round((timer.endTime - now) / 1000)) : 0;
    res.json({
      ...serializeTimer(timer),
      remaining,
    });
  });

  router.patch('/:id/recipients', (req, res) => {
    const timer = timers[req.params.id];
    if (!timer) return res.status(404).json({ error: 'Not found' });

    if (!Array.isArray(req.body.recipients)) {
      return res.status(400).json({ error: 'Recipients must be an array' });
    }

    timer.recipients = mergeRecipients(timer.recipients || [], req.body.recipients);

    io.emit('dashboard-timer-updated', { ...serializeTimer(timer), action: 'recipients-added' });
    res.json({ success: true, recipients: timer.recipients });
  });

  router.delete('/:id/recipients', (req, res) => {
    const timer = timers[req.params.id];
    if (!timer) return res.status(404).json({ error: 'Not found' });
    if (!Array.isArray(req.body.recipients)) {
      return res.status(400).json({ error: 'Recipients must be an array' });
    }
    timer.recipients = (timer.recipients || []).filter(recipient => !req.body.recipients.includes(recipient));
    io.emit('dashboard-timer-updated', { ...serializeTimer(timer), action: 'recipients-removed' });
    res.json({ success: true, recipients: timer.recipients });
  });

  return router;
};

module.exports = api;
module.exports.timers = timers;
