// timer-api.js

const recipientsDal = require('../dal/recipients-dal');
const devicesDal = require('../dal/devices-dal');

const express = require('express');
const timersDal = require('../dal/timers-dal');

const webpush = require('web-push');

const dashboardTimers = {};

// this endpoint is /api/timers - should we change to /api/timer?

/**
 * Schedules a timer to expire on the backend.
 * @param {object} timer - Timer object from DB (must include id, end_time).
 * @param {function} onExpire - Function to call when timer lapses.
 */
function scheduleDashboardTimer(timer, onExpire) {
  console.log('reimagine scheduleDashboardTimer!')
  // Clear existing timeout if present
  if (dashboardTimers[timer.id]?.timeout) {
    clearTimeout(dashboardTimers[timer.id].timeout);
  }

  // Calculate ms until end
  const ms = new Date(timer.end_time).getTime() - Date.now();
  if (ms <= 0) {
    // Already expired; run expiration handler immediately
    if (onExpire) onExpire(timer);
    // Send push notification for lapse
    notifyAllRecipients(timer, 'lapsed');
    delete dashboardTimers[timer.id];
    return;
  }

  // Schedule the timer expiration
  const timeout = setTimeout(() => {
    if (onExpire) onExpire(timer);
    // Send push notification for lapse
    notifyAllRecipients(timer, 'lapsed');
    delete dashboardTimers[timer.id];
  }, ms);

  dashboardTimers[timer.id] = {
    endTime: timer.end_time,
    timeout,
  };
}

async function notifyAllRecipients(timer, status = 'lapsed') {
  console.log("[notifyAllRecipients] called (persistent DB)", timer.name, status);

  console.log("what is timer.id: ", timer.id)
  // --- NEW: Fetch all recipient mappings for this timer from the persistent DB ---
  const recipientRows = await recipientsDal.getRecipientsByTimer(timer.id);
  console.log("what is recipientRows: ")
  if (!recipientRows || recipientRows.length === 0) {
    console.log("[notifyAllRecipients] No recipients in DB for this timer.");
    return;
  }

  // For each recipient mapping (row in recipients table)
  for (const rec of recipientRows) {
    console.log("for const rec of recipientsRow")
    let targetDevices = [];

    if (rec.device_id) {
      // --- NEW: Notify a specific device only ---
      const device = await devicesDal.getDevicesByContactId(rec.contact_id)
        .then(devices => devices.find(d => d.id == rec.device_id));
      if (device) targetDevices.push(device);
    } else {
      // --- NEW: Notify ALL devices for this contact ---
      const devices = await devicesDal.getDevicesByContactId(rec.contact_id);
      targetDevices = devices;
    }

    console.log("is targetDevices something: ", targetDevices)
    // For each device, send push notification if subscription exists
    for (const device of targetDevices) {
      try {
        console.log("for loop before webpush.sendNotification")
        if (device.subscription) {
          const subscription = typeof device.subscription === 'string'
            ? JSON.parse(device.subscription)
            : device.subscription;
          await webpush.sendNotification(
            subscription,
            JSON.stringify({
              title: `Timer "${timer.name}" ${status === 'lapsed' ? 'expired' : 'canceled'}!`,
              body: status === 'lapsed'
                ? `The timer "${timer.name}" has finished.`
                : `The timer "${timer.name}" was canceled.`,
            })
          );
          console.log(`[notifyAllRecipients] Notification sent to device ${device.device_name} (${device.id})`);
        }
      } catch (err) {
        console.error(`[web-push] Failed to notify device ${device.id}:`, err);
      }
    }
  }
}



function createTimerRouter(io) {
  const router = express.Router();

  // Create a new timer
  router.post('/', async (req, res) => {
    try {
      const { name, minutes } = req.body;
      if (!name || !minutes || isNaN(minutes) || minutes < 1) {
        return res.status(400).json({ error: 'Invalid name or minutes' });
      }
      // Timer starts as 'pending'
      const timer = await timersDal.createTimer({
        name,
        minutes,
        status: 'pending',
        created_at: new Date().toISOString()
      });
      io.emit('dashboard-timer-created', timer);
      res.json(timer);
    } catch (error) {
      console.error('[timer-api] POST / error:', error);
      res.status(500).json({ error: 'Failed to create timer' });
    }
  });

  // List timer history (expired/canceled or otherwise completed)
  router.get('/history', async (req, res) => {
    console.log("revise how we look at historical timers!")
  });

  // --- Route: Get Timer Status (LIVE) ---
  router.get('/:id/status', async (req, res) => {
    try {
      const timer = await timersDal.getTimerById(req.params.id);
      if (!timer || !timer.is_running || !timer.end_time) {
        return res.json({ running: false, remaining: 0 });
      }
      const now = Date.now();
      const end = new Date(timer.end_time).getTime();
      const remaining = Math.max(0, Math.round((end - now) / 1000));
      res.json({ running: timer.is_running, remaining });
    } catch (e) {
      res.status(500).json({ error: 'Failed to get timer status' });
    }
  });

  // Get a single timer
  router.get('/:id', async (req, res) => {
    try {
      const timer = await timersDal.getTimerById(req.params.id);
      if (!timer) return res.status(404).json({ error: 'Not found' });
      const now = Date.now();
      let remaining = 0;
      if (running && timer.end_time) {
        remaining = Math.max(0, Math.round((new Date(timer.end_time).getTime() - now) / 1000));
      }
      res.json({
        ...timer,
        running,
        remaining,
        display: running ? '' : '', // Or leave out, computed in Vue
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get timer' });
    }
  });


  // List all active timers
  router.get('/', async (req, res) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 100;
      const timers = await timersDal.getAllTimers(limit);
      res.json(timers);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get timers' });
    }
  });

  // --- Route: Start/add-to timer ---
  router.post('/:id/start', async (req, res) => {
    try {
      const { minutes } = req.body;
      console.log('[backend] POST /:id/start called, minutes:', minutes)
      // Get timer from DB
      const timer = await timersDal.getTimerById(req.params.id);
      if (!timer) {
        console.log('[backend] Timer not found')
        return res.status(404).json({ error: 'Not found' });
      }

      // Calculate new end time
      const now = Date.now();
      const endTime = new Date(now + minutes * 60 * 1000).toISOString();

      // Update timer in DB
      await timersDal.updateTimer(timer.id, {
        minutes,
        end_time: endTime,
        status: 'running',
      });

      // Fetch updated timer
      const updated = await timersDal.getTimerById(timer.id);
      console.log('[backend] Timer started, updated:', updated);

      // Schedule backend expiration
      scheduleDashboardTimer(updated, async (expiredTimer) => {
        console.log('[backend] Timer expired, id:', expiredTimer.id);
        const finishedAt = new Date().toISOString();
        const nowMs = Date.now();
        await timersDal.updateTimer(expiredTimer.id, {
          end_time: nowMs,
          status: "finished",
          completed_at: finishedAt
        });
        io.emit('dashboard-timer-updated', {
          ...expiredTimer,
          end_time: nowMs,
          status: "finished",
          completed_at:finishedAt
        });
      });

      // Notify clients
      io.emit('dashboard-timer-updated', updated);

      res.json({ success: true, timer: updated });
    } catch (error) {
      console.error('[timer-api] POST /:id/start error:', error);
      res.status(500).json({ error: 'Failed to start timer' });
    }
  });



  // Cancel timer
  router.post('/:id/cancel', async (req, res) => {
    try {
      const timerId = req.params.id;
      // Update the timer in the DB
      await timersDal.updateTimer(timerId, {
        status: 'canceled',
        completed_at: new Date().toISOString()
      });

      // Optional: clear backend timer, if using in-memory setTimeout
      if (dashboardTimers[timerId]?.timeout) {
        clearTimeout(dashboardTimers[timerId].timeout);
        delete dashboardTimers[timerId];
      }

      // Fetch updated timer and emit to clients
      const updated = await timersDal.getTimerById(timerId);
      io.emit('dashboard-timer-updated', updated);

      // Optional: Notify recipients
      notifyAllRecipients(updated, 'canceled');

      res.json({ success: true, timer: updated });
    } catch (error) {
      console.error('[timer-api] POST /:id/cancel error:', error);
      res.status(500).json({ error: 'Failed to cancel timer' });
    }
  });


  // POST /api/timers/:id/recipients
  router.post('/:id/recipients', async (req, res) => {
    try {
      const timerId = req.params.id;
      const { contactId, deviceId } = req.body;
      if (!contactId) {
        return res.status(400).json({ error: 'Missing contactId' });
      }
      // deviceId can be null or omitted if you want to notify all devices for the contact

      // Add recipient to the recipients table using your recipients-dal
      await recipientsDal.addRecipient(timerId, contactId, deviceId ?? null);

      res.json({ success: true });
    } catch (error) {
      // Handle unique constraint violation gracefully
      if (error && error.code === 'SQLITE_CONSTRAINT') {
        return res.status(409).json({ error: 'Recipient already exists' });
      }
      res.status(500).json({ error: 'Failed to add recipient' });
    }
  });

  // PATCH /:id/recipients to add/update recipients
  router.patch('/:id/recipients', async (req, res) => {
    try {
      const { recipients } = req.body;
      if (!Array.isArray(recipients)) {
        return res.status(400).json({ error: 'Recipients must be an array' });
      }
      const updated = await timersDal.updateTimerRecipients(req.params.id, recipients);
      io.emit('dashboard-timer-updated', { ...updated, action: 'recipients-added' });
      res.json({ success: true, recipients: updated.recipients });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update recipients' });
    }
  });

  // Remove recipients
  router.delete('/:id/recipients', async (req, res) => {
    try {
      const { recipients } = req.body;
      if (!Array.isArray(recipients)) {
        return res.status(400).json({ error: 'Recipients must be an array' });
      }
      const updated = await timersDal.removeTimerRecipients(req.params.id, recipients);
      io.emit('dashboard-timer-updated', { ...updated, action: 'recipients-removed' });
      res.json({ success: true, recipients: updated.recipients });
    } catch (error) {
      res.status(500).json({ error: 'Failed to remove recipients' });
    }
  });

  return router;
}

module.exports = createTimerRouter;
