const { reactive } = require('vue');
const smartTimerDAL = require('../dal/smartTimer-dal');
const eventBus = require('../utils/eventBus');

const smartTimers = reactive({});

function rehydrateSmartTimers() {
  console.log("[REHYDRATE] 1 /src/data/smartTimers.js", Date.now())
  const allTimers = smartTimerDAL.listAllSmartTimers();
  for (const key in smartTimers) delete smartTimers[key];
  allTimers.forEach(timer => {
    smartTimers[timer.id] = timer;
  });
  eventBus.emit('smart-timers:snapshot', Object.values(smartTimers));
}

rehydrateSmartTimers();

module.exports = {
  smartTimers,
  rehydrateSmartTimers
}