const express = require('express');

// In-memory storage (replace with DB for production)
let nextTimerId = 1;
const timers = {};          // { id: timerObj }
const timerHistory = [];    // [{...}]

// Timer structure: { id, name, running, remaining, endTime, created, lastAction }

function nowMs() { return Date.now(); }

function serializeTimer(timer) {
  // Remove the .timeout property for safe JSON
  const { timeout, ...safe } = timer;
  return safe;
}

module.exports = (io) => {
  const router = express.Router();

  // Updated: scheduleTimer now takes io as a closure variable
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
      timerHistory.push({ ...timer });
      delete timers[timer.id];
      io.emit('dashboard-timer-removed', { id: timer.id });
    }, ms);
  }

  // Create a new timer
  router.post('/', (req, res) => {
    const { name, minutes } = req.body;
    if (!name || !minutes || isNaN(minutes) || minutes < 1) {
      return res.status(400).json({ error: 'Invalid name or minutes' });
    }
    const id = String(nextTimerId++);
    const created = new Date();
    const timer = {
      id,
      name,
      minutes,
      running: false,
      remaining: minutes * 60, // seconds
      endTime: null,
      created,
      lastAction: created
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
  router.post('/:id/start', (req, res) => {
    const t = timers[req.params.id];
    const minutes = parseInt(req.body.minutes, 10);
    if (!t) return res.status(404).json({ error: 'Not found' });
    if (isNaN(minutes) || minutes < 1) return res.status(400).json({ error: 'Invalid minutes' });

    const now = nowMs();
    t.inputMinutes = minutes;
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
    io.emit('dashboard-timer-updated', { ...serializeTimer(t), action: 'updated' });
    res.json({ success: true, timer: serializeTimer(t) });
  });

  // Cancel timer
  router.post('/:id/cancel', (req, res) => {
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
  });

  // Get timer status
  router.get('/:id/status', (req, res) => {
    const t = timers[req.params.id];
    if (!t) return res.status(404).json({ error: 'Not found' });
    const now = nowMs();
    let remaining = t.running && t.endTime ? Math.max(0, Math.round((t.endTime - now) / 1000)) : 0;
    res.json({
      id: t.id,
      name: t.name,
      running: t.running,
      remaining,
      endTime: t.endTime,
      created: t.created,
      lastAction: t.lastAction
    });
  });


  // List timer history (expired/canceled)
  router.get('/history', (req, res) => {
    res.json(timerHistory.map(serializeTimer));
  });

  return router;
};






// const express = require('express');
// const router = express.Router();

// // In-memory storage (replace with DB for production)
// let nextTimerId = 1;
// const timers = {};          // { id: timerObj }
// const timerHistory = [];    // [{...}]

// // Timer structure: { id, name, , remaining, endTime, created, lastAction }

// module.exports = (io) => {
//   const express = require('express');
//   const router = express.Router();
//   // ... rest of your code ...

//   function nowMs() { return Date.now(); }

//   function scheduleTimer(timer) {
//     // Clear previous timeout if any
//     if (timer.timeout) clearTimeout(timer.timeout);
//     if (!timer.running || timer.remaining <= 0) return;

//     const ms = timer.endTime - nowMs();
//     timer.timeout = setTimeout(() => {
//       // Move to history
//       timer.running = false;
//       timer.remaining = 0;
//       timer.completed = true;
//       timer.lastAction = new Date();
//       timerHistory.push({ ...timer });
//       delete timers[timer.id];
//       // (Optional) emit a websocket update here
//       io.emit('dashboard-timer-update', { action: 'lapsed', id: timer.id });
//     }, ms);
//   }

//   function serializeTimer(timer) {
//     // Remove the .timeout property for safe JSON
//     const { timeout, ...safe } = timer;
//     return safe;
//   }






//   // Create a new timer
//   router.post('/', (req, res) => {
//     const { name, minutes } = req.body;
//     if (!name || !minutes || isNaN(minutes) || minutes < 1) {
//       return res.status(400).json({ error: 'Invalid name or minutes' });
//     }
//     const id = String(nextTimerId++);
//     const created = new Date();
//     const timer = {
//       id,
//       name,
//       minutes,
//       running: false,
//       remaining: minutes * 60, // seconds
//       endTime: null,
//       created,
//       lastAction: created
//     };
//     timers[id] = timer;
//     io.emit('dashboard-timer-created', timer);
//     res.json(serializeTimer(timer));
//   });

//   // List all active timers
//   router.get('/', (req, res) => {
//     res.json(Object.values(timers).map(serializeTimer));
//   });

//   // List timer history (expired/canceled)
//   router.get('/history', (req, res) => {
//     res.json(timerHistory.map(serializeTimer));
//   });

//   // Get a single timer
//   router.get('/:id', (req, res) => {
//     const t = timers[req.params.id];
//     if (!t) return res.status(404).json({ error: 'Not found' });
//     res.json(serializeTimer(t));
//   });

//   // Start/add-to timer
//   router.post('/:id/start', (req, res) => {
//     const t = timers[req.params.id];
//     const minutes = parseInt(req.body.minutes, 10);
//     if (!t) return res.status(404).json({ error: 'Not found' });
//     if (isNaN(minutes) || minutes < 1) return res.status(400).json({ error: 'Invalid minutes' });

//     const now = nowMs();
//     if (!t.running) {
//       t.running = true;
//       t.endTime = now + minutes * 60 * 1000;
//       t.remaining = minutes * 60;
//     } else {
//       t.endTime += minutes * 60 * 1000;
//       t.remaining = Math.round((t.endTime - now) / 1000);
//     }
//     t.lastAction = new Date();
//     scheduleTimer(t);
//     io.emit('dashboard-timer-update', { action: 'updated', timer: serializeTimer(t) });
//     res.json({ success: true, timer: serializeTimer(t) });
//   });

//   // Cancel timer
//   router.post('/:id/cancel', (req, res) => {
//     const t = timers[req.params.id];
//     if (!t) return res.status(404).json({ error: 'Not found' });
//     if (t.timeout) clearTimeout(t.timeout);
//     t.running = false;
//     t.remaining = 0;
//     t.completed = false;
//     t.lastAction = new Date();
//     // Move to history as canceled, but remove .timeout from stored history
//     timerHistory.push({ ...serializeTimer(t), canceled: true });
//     delete timers[t.id];
//     io.emit('dashboard-timer-update', { action: 'canceled', id: t.id });
//     res.json({ success: true });
//   });


//   // Get timer status
//   router.get('/:id/status', (req, res) => {
//     const t = timers[req.params.id];
//     if (!t) return res.status(404).json({ error: 'Not found' });
//     const now = nowMs();
//     let remaining = t.running && t.endTime ? Math.max(0, Math.round((t.endTime - now) / 1000)) : 0;
//     res.json({
//       id: t.id,
//       name: t.name,
//       running: t.running,
//       remaining,
//       endTime: t.endTime,
//       created: t.created,
//       lastAction: t.lastAction
//     });
//   });
//   return router;
// };

