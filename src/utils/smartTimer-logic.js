// src/utils/smartTimer-logic.js
const { timers } = require('../data/smartTimers');
const smartTimerDAL = require('../dal/smartTimer-dal');
const eventBus = require('./eventBus');
const { mqttClient } = require('../mqtt/mqtt-client');
const { publishSmartTimerState } = require('./smartTimer-mqtt');

const activeTimerTimeouts = {}; // Local map: timerId -> timeout

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
    timers[timer.id] = timer; // update in-mem store
    eventBus.emit('timer:finished', timer);
    publishSmartTimerState(mqttClient, timer);
  }
}

module.exports = {
  scheduleTimerFinish,
  finishTimerAndNotify,
};
