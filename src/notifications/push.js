const webpush = require('web-push');
const { logError, logInfo } = require('../utils/logger');
const deviceDAL = require('../dal/device-dal');

async function sendPushToRecipients(recipients, payload) {
  if (!Array.isArray(recipients) || recipients.length === 0) return;

  for (const recipient of recipients) {
    switch (recipient.type) {
      case 'webpush': {
        // Look up the device to get its pushSubscription object
        const device = deviceDAL.getDeviceById(recipient.deviceId);
        if (device && device.pushSubscription && device.pushSubscription.endpoint) {
          // Forward the actual pushSubscription as the "target"
          await sendWebPush({ ...recipient, target: device.pushSubscription }, payload);
        } else {
          console.warn('Device not found or missing pushSubscription for deviceId:', recipient.deviceId);
        }
        break;
      }
      case 'email':
        await sendEmail(recipient, payload);
        break;
      case 'sms':
        await sendSms(recipient, payload);
        break;
      // Add more types as needed
      default:
        console.warn('Unknown recipient type:', recipient.type);
    }
  }
}

async function sendWebPush(recipient, payload) {
  if (!recipient.target) return;
  try {
    await webpush.sendNotification(recipient.target, JSON.stringify(payload));
    logInfo('WebPush sent to recipient:', recipient.id);
  } catch (err) {
    // Optionally use your logger here
    logError('WebPush failed for recipient:', recipient.id, err.message);
  }
}

async function sendEmail(recipient, payload) {
  // Placeholder: integrate with nodemailer, sendgrid, or other email service as needed
  try {
    // Example: await nodemailerTransport.sendMail({ to: recipient.email, subject: payload.subject, text: payload.body });
    logInfo('Pretend sent email to', recipient.target, 'with payload:', payload);
    // Remove above log and implement actual sending logic in production
  } catch (err) {
    logError('Email send failed for recipient:', recipient.target, err.message);
  }
}

// Example stubs (fill these in with your actual logic)
async function sendSms(recipient, payload) {
  // ...SMS logic...
  try {
    logInfo('Pretending to send sms to', recipient.target, 'with payload:', payload)
  } catch (err) {
    logError('Sms send failed for recipient:', recipient.target, err.message)
  }
}

module.exports = {
  sendPushToRecipients,
};
