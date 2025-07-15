const recipientDAL = require('../dal/recipient-dal');
const { sendPushToRecipients } = require('../notifications/push');

const EventEmitter = require('events');

// Create a singleton EventBus for app-wide event broadcasting and listening
const eventBus = new EventEmitter();

// (Optional) Set max listeners to avoid warning if many modules subscribe
eventBus.setMaxListeners(50);

// timer:started
eventBus.on('timer:started', async (timer) => {
  const recipients = await recipientDAL.getRecipientsForTimer(timer.id);
  const payload = { type: 'timerStarted', timer };
  await sendPushToRecipients(recipients, payload);
});

// timer:addedTo
eventBus.on('timer:addedTo', async (timer) => {
  const recipients = await recipientDAL.getRecipientsForTimer(timer.id);
  const payload = { type: 'timerAddedTo', timer };
  await sendPushToRecipients(recipients, payload);
});

// timer:paused
eventBus.on('timer:paused', async (timer) => {
  const recipients = await recipientDAL.getRecipientsForTimer(timer.id);
  const payload = { type: 'timerPaused', timer };
  await sendPushToRecipients(recipients, payload);
});

// timer:canceled
eventBus.on('timer:canceled', async (timer) => {
  const recipients = await recipientDAL.getRecipientsForTimer(timer.id);
  const payload = { type: 'timerCanceled', timer };
  await sendPushToRecipients(recipients, payload);
});

// timer:finished
eventBus.on('timer:finished', async (timer) => {
  const recipients = await recipientDAL.getRecipientsForTimer(timer.id);
  const payload = { type: 'timerFinished', timer };
  await sendPushToRecipients(recipients, payload);
});

module.exports = eventBus;