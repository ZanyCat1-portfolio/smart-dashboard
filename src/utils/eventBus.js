const recipientDAL = require('../dal/recipient-dal');
const smartTimerDAL = require('../dal/smartTimer-dal')
const { sendPushToRecipients } = require('../notifications/push');
const EventEmitter = require('events');

// Singleton EventBus for app-wide broadcasting
const eventBus = new EventEmitter();

// --- Add this to support io.emit ---
let ioInstance = null;
eventBus.setIo = (io) => {
  ioInstance = io;
};
// ------------------------------------

// (Optional) Set max listeners
eventBus.setMaxListeners(50);

// timer:created
eventBus.on('timer:created', async (timer) => {
  // Always emit to all sockets
  if (ioInstance) ioInstance.emit('smart-timer-update', timer);
});

// timer:started
eventBus.on('timer:started', async (timer) => {
  const recipients = await recipientDAL.getRecipientsForTimer(timer.id);
  const payload = { type: 'timerStarted', timer };
  await sendPushToRecipients(recipients, payload);
  if (ioInstance) ioInstance.emit('smart-timer-update', timer);
});

// timer:addedTo (if you use this elsewhere)
eventBus.on('timer:addedTo', async (timer) => {
  const recipients = await recipientDAL.getRecipientsForTimer(timer.id);
  const payload = { type: 'timerAddedTo', timer };
  await sendPushToRecipients(recipients, payload);
  if (ioInstance) ioInstance.emit('smart-timer-update', timer);
});

// timer:paused
// should resync timer's countdown on pause, maybe on unpause too?
eventBus.on('timer:paused', async (timer) => {
  const recipients = await recipientDAL.getRecipientsForTimer(timer.id);
  const payload = { type: 'timerPaused', timer };
  await sendPushToRecipients(recipients, payload);
  if (ioInstance) ioInstance.emit('smart-timer-update', timer);
});

// should resync timer's countdown on unpause, maybe on pause too?
eventBus.on('timer:unpaused', async (timer) => {
  const recipients = await recipientDAL.getRecipientsForTimer(timer.id);
  const payload = { type: 'timerUnpaused', timer };
  await sendPushToRecipients(recipients, payload);
  if (ioInstance) ioInstance.emit('smart-timer-update', timer);
});

// timer:canceled
eventBus.on('timer:canceled', async (timer) => {
  const recipients = await recipientDAL.getRecipientsForTimer(timer.id);
  const payload = { type: 'timerCanceled', timer };
  await sendPushToRecipients(recipients, payload);
  if (ioInstance) ioInstance.emit('smart-timer-update', timer);
});

// timer:finished
eventBus.on('timer:finished', async (timer) => {
  const recipients = await recipientDAL.getRecipientsForTimer(timer.id);
  const payload = { type: 'timerFinished', timer };
  await sendPushToRecipients(recipients, payload);
  if (ioInstance) ioInstance.emit('smart-timer-update', timer);
});

eventBus.on('recipients:updated', ({ timerId, recipient }) => {
  // console.log("eventbus emits smart-timer-update")
  const timer = smartTimerDAL.getSmartTimerById(timerId);
  timer.recipients = recipientDAL.getRecipientsForTimer(timerId); // (if not already set)
  if (ioInstance) ioInstance.emit('smart-timer-update', timer);
});

eventBus.on('device:created', device => {
  if (ioInstance) ioInstance.emit('device:created', device);
});

eventBus.on('device:reactivated', device => {
  if (ioInstance) ioInstance.emit('device:reactivated', device);
});

eventBus.on('device:deactivated', device => {
  if (ioInstance) ioInstance.emit('device:deactivated', device);
});

// --- Users ---
eventBus.on('user:created', user => {
  if (ioInstance) ioInstance.emit('user:created', user);
});

eventBus.on('user:reactivated', user => {
  if (ioInstance) ioInstance.emit('user:reactivated', user);
});

eventBus.on('user:deactivated', user => {
  if (ioInstance) ioInstance.emit('user:deactivated', user);
});

eventBus.on('users:snapshot', usersArray => {
  // console.log("eventBus.on users:snapshot: usersArray:", usersArray)
  if (ioInstance) ioInstance.emit('users:snapshot', usersArray);
});

eventBus.on('devices:snapshot', devicesArray => {
  if (ioInstance) ioInstance.emit('devices:snapshot', devicesArray);
});

// we aren't using smartTimers:snapshot
eventBus.on('smartTimers:snapshot', timersArray => {
  console.log("[SMARTTIMERS:SNAPSHOT] in eventBus.js")
  if (ioInstance) ioInstance.emit('smartTimers:snapshot', timersArray);
});


// If you want to emit on recipient changes as well, you could add events like:
// eventBus.on('recipients:updated', async (timer) => { if (ioInstance) ioInstance.emit('smart-timer-update', timer); });

module.exports = eventBus;
