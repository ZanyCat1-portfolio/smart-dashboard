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


// At top of timer-api.js
const { contacts } = require('./contacts-api'); // or wherever your contacts live
const webpush = require('web-push');

// Async notifyRecipients
async function notifyRecipients(timer, message) {
  console.log('[NOTIFY]', { timer, message });

  if (!Array.isArray(timer.recipients)) return;

  // Filter to only valid recipient objects
  const validRecipients = timer.recipients.filter(rec =>
    rec && typeof rec.contactId !== 'undefined' && Array.isArray(rec.devices)
  );

  if (validRecipients.length !== timer.recipients.length) {
    console.warn(
      '[NOTIFY] Some recipients are invalid and will be skipped:',
      timer.recipients.filter(rec => !rec || typeof rec.contactId === 'undefined')
    );
  }

  for (const rec of validRecipients) {
    console.log("[NOTIFY] Processing recipient:", rec);
    const contact = contacts[rec.contactId];
    if (!contact) {
      console.warn('[NOTIFY] No contact found for contactId:', rec.contactId);
      continue;
    }
    const deviceList = rec.devices.length
      ? contact.devices.filter(d => rec.devices.some(r => String(r.id) === String(d.id)))
      : contact.devices;
    for (const device of deviceList) {
      if (!device.subscription) continue;
      try {
        await webpush.sendNotification(device.subscription, JSON.stringify({
          title: 'Timer Alert',
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





module.exports = (io) => {
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
      notifyRecipients(timer, 'Timer "${timer.name}" completed!')
      timerHistory.push({ ...timer });
      delete timers[timer.id];
      io.emit('dashboard-timer-removed', { id: timer.id });
    }, ms);
  }

  // Create a new timer
  router.post('/', (req, res) => {
    const { name, minutes, recipients = [] } = req.body;
    if (!name || !minutes || isNaN(minutes) || minutes < 1) {
      return res.status(400).json({ error: 'Invalid name or minutes' });
    }
    const id = String(nextTimerId++);
    const created = new Date();
    const timer = {
      id,
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
    timers[id] = timer;
    io.emit('dashboard-timer-created', serializeTimer(timer));
    res.json(serializeTimer(timer));
  });

  // List all active timers
  router.get('/', (req, res) => {
    res.json(Object.values(timers).map(serializeTimer));
  });

  // List timer history (expired/canceled)
  router.get('/history', (req, res) => {
    res.json(timerHistory.map(serializeTimer));
  });

  // Get a single timer
  router.get('/:id', (req, res) => {
    const t = timers[req.params.id];
    if (!t) return res.status(404).json({ error: 'Not found' });
    res.json(serializeTimer(t));
  });

  // Start/add-to timer
  // Start/add-to timer
  router.post('/:id/start', async (req, res) => {
    const t = timers[req.params.id];
    const minutes = parseInt(req.body.minutes, 10);
    if (!t) return res.status(404).json({ error: 'Not found' });
    if (isNaN(minutes) || minutes < 1) return res.status(400).json({ error: 'Invalid minutes' });

    const now = nowMs();
    t.inputMinutes = null; // CLEAR after timer starts, so field is blank on all clients
    if (!t.running) {
      t.running = true;
      t.endTime = now + minutes * 60 * 1000;
      t.remaining = minutes * 60;
    } else {
      t.endTime += minutes * 60 * 1000;
      t.remaining = Math.round((t.endTime - now) / 1000);
    }
    t.lastAction = new Date();
    scheduleTimer(t);
    io.emit('dashboard-timer-updated', {
      ...serializeTimer(t),
      remaining: t.remaining, // Ensure this is the just-set value
      action: 'updated'
    });

    // Respond quickly to client
    res.json({ success: true, timer: serializeTimer(t) });

    // ---- Send notifications ----
    try {
      await notifyRecipients(t, `Timer "${t.name}" started for ${minutes} minute${minutes !== 1 ? 's' : ''}.`);
    } catch (err) {
      console.error('Error notifying recipients:', err);
    }
  });

  // Cancel timer
  router.post('/:id/cancel', async (req, res) => {
    const t = timers[req.params.id];
    if (!t) return res.status(404).json({ error: 'Not found' });
    if (t.timeout) clearTimeout(t.timeout);
    t.running = false;
    t.remaining = 0;
    t.completed = false;
    t.lastAction = new Date();
    timerHistory.push({ ...serializeTimer(t), canceled: true });
    delete timers[t.id];
    io.emit('dashboard-timer-removed', { id: t.id, action: 'canceled' });
    res.json({ success: true });

    // ---- Send notifications ----
    try {
      await notifyRecipients(t, `Timer "${t.name}" was canceled.`);
    } catch (err) {
      console.error('Error notifying recipients:', err);
    }
  });

  // Get timer status
  router.get('/:id/status', (req, res) => {
    const t = timers[req.params.id];
    if (!t) return res.status(404).json({ error: 'Not found' });
    const now = nowMs();
    let remaining = t.running && t.endTime ? Math.max(0, Math.round((t.endTime - now) / 1000)) : 0;
    res.json({
      ...serializeTimer(t),
      remaining,
    });
  });

  // PATCH /:id/recipients to add recipients (union, no duplicates), with io.emit
  router.patch('/:id/recipients', (req, res) => {
    const t = timers[req.params.id];
    if (!t) return res.status(404).json({ error: 'Not found' });

    if (!Array.isArray(req.body.recipients)) {
      return res.status(400).json({ error: 'Recipients must be an array' });
    }

    // Union new recipients with existing, avoid duplicates
    t.recipients = Array.from(new Set([...(t.recipients || []), ...req.body.recipients]));

    io.emit('dashboard-timer-updated', { ...serializeTimer(t), action: 'recipients-added' });
    res.json({ success: true, recipients: t.recipients });
  });


  // Remove recipients
  router.delete('/:id/recipients', (req, res) => {
    const t = timers[req.params.id];
    if (!t) return res.status(404).json({ error: 'Not found' });
    if (!Array.isArray(req.body.recipients)) {
      return res.status(400).json({ error: 'Recipients must be an array' });
    }
    t.recipients = (t.recipients || []).filter(r => !req.body.recipients.includes(r));
    io.emit('dashboard-timer-updated', { ...serializeTimer(t), action: 'recipients-removed' });
    res.json({ success: true, recipients: t.recipients });
  });

  return router;
};
