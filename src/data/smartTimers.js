const { reactive } = require('vue');
const smartTimerDAL = require('../dal/smartTimer-dal');
const eventBus = require('../utils/eventBus');
const fetch    = require('node-fetch');

const PORT = process.env.VITE_PORT || 5173;
const API_BASE = `https://localhost:${PORT}`;

const base = `${API_BASE}${process.env.BASE_PATH || '/'}`;
const smartTimers = reactive({});

console.log("BACKEND process.env.VITE_PORT: ", process.env.VITE_PORT)

async function rehydrateSmartTimers() {
  const allTimers = smartTimerDAL.listAllSmartTimers();
  for (const key in smartTimers) delete smartTimers[key];

  console.log("what is the path: ", `${base}api/smart-timers/${process.env.VITE_PORT}/finish`)
  // We'll finish lapsed timers via the REST API
  await Promise.all(allTimers.map(async (timer) => {
    if (
      timer.state === 'running' &&
      timer.endTime &&
      new Date(timer.endTime) <= Date.now()
    ) {
      // Make API call to finish this timer
      try {
        await fetch(`${base}api/smart-timers/${timer.id}/finish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        // Optionally fetch the updated timer object here if needed
        // const updated = await res.json(); smartTimers[timer.id] = updated;
        // But we’ll get it on the next rehydrate, or keep local version for now
        timer.state = 'finished';
        timer.finishedAt = timer.endTime;
      } catch (err) {
        console.error(`Failed to finish timer ${timer.id}:`, err);
      }
    }
    // Always update in-mem
    smartTimers[timer.id] = timer;
  }));

  eventBus.emit('smart-timers:snapshot', Object.values(smartTimers));
}

rehydrateSmartTimers();

module.exports = {
  smartTimers,
  rehydrateSmartTimers
};
