const express = require('express');

// In-memory store (replace with DB later)
let nextContactId = 1;
const contacts = {}; // contactId: { id, name, devices: [{ id, name, subscription, public, platform }] }

function createContactsRouter(io, timers) {
    const router = express.Router();

    // --- Remove device from all timers' recipient lists ---
    function removeDeviceFromRecipients(deviceId) {
        console.log('Removing device from recipients:', deviceId);
        if (!timers) {
            console.warn('[WARN] timers object not passed to contacts-api');
            return;
        }
        for (const timerId in timers) {
            const timer = timers[timerId];
            console.log(`[Check] Timer ${timerId}: recipients before=`, JSON.stringify(timer.recipients));
            if (!Array.isArray(timer.recipients)) continue;
            let changed = false;

            timer.recipients.forEach(recipient => {
                if (Array.isArray(recipient.devices)) {
                    const before = recipient.devices.length;
                    recipient.devices = recipient.devices.filter(device => String(device.id) !== String(deviceId));
                    if (recipient.devices.length !== before) {
                        changed = true;
                    }
                }
            });

            // Remove recipients with no devices left
            const beforeCount = timer.recipients.length;
            timer.recipients = timer.recipients.filter(recipient => Array.isArray(recipient.devices) && recipient.devices.length > 0);

            if (changed || timer.recipients.length !== beforeCount) {
                console.log(`[Recipients] Removed device ${deviceId} from timer ${timerId}`);
            }
            console.log(`[Check] Timer ${timerId}: recipients after=`, JSON.stringify(timer.recipients));
        }
    }

    // Register a new contact (with one device)
    router.post('/register', (req, res) => {
        console.log('All contacts/devices at registration:', JSON.stringify(contacts, null, 2));
        const { contactName, deviceName, subscription, isPublic, platform } = req.body;
        if (!contactName || !deviceName || !subscription || !subscription.endpoint) {
            return res.status(400).json({ error: 'Missing fields or invalid subscription' });
        }
        // Check if device is already registered to any user
        for (const contact of Object.values(contacts)) {
            for (const device of contact.devices) {
                if (device.subscription?.endpoint === subscription.endpoint) {
                    const msg = (contact.name === contactName)
                        ? 'This device is already registered to this user.'
                        : 'This device is already registered to another user.';
                    return res.status(409).json({ error: msg });
                }
            }
        }
        // Find or create the contact/user
        let contact = Object.values(contacts).find(contact => contact.name === contactName);
        if (!contact) {
            contact = { id: nextContactId++, name: contactName, devices: [] };
            contacts[contact.id] = contact;
        }
        // Register the device to the user
        const deviceId = Date.now() + Math.floor(Math.random() * 1000);
        contact.devices.push({
            id: deviceId,
            name: deviceName,
            subscription,
            public: !!isPublic,
            platform: platform || 'unknown'
        });
        io.emit('contact-registered', contact);
        res.json({ success: true, contact });
    });

    // List all contacts and devices (with optional public filter)
    router.get('/', (req, res) => {
        const onlyPublic = req.query.public === 'true';
        let contactList = Object.values(contacts);
        if (onlyPublic) {
            contactList = contactList.map(contactObj => ({
                ...contactObj,
                devices: contactObj.devices.filter(deviceObj => deviceObj.public)
            })).filter(contactObj => contactObj.devices.length > 0);
        }
        res.json(contactList);
    });

    // Delete a device from a contact
    router.delete('/:contactId/devices/:deviceId', (req, res) => {
        console.log("Am I being called?");
        const { contactId, deviceId } = req.params;
        const contact = contacts[contactId];
        if (!contact) return res.status(404).json({ error: 'Contact not found' });
        // Find the device to get its subscription endpoint
        const deviceToRemove = contact.devices.find(deviceObj => String(deviceObj.id) === String(deviceId));
        const endpointToRemove = deviceToRemove?.subscription?.endpoint;
        // Remove by deviceId OR matching endpoint
        contact.devices = contact.devices.filter(deviceObj => 
            String(deviceObj.id) !== String(deviceId) &&
            (!endpointToRemove || deviceObj.subscription?.endpoint !== endpointToRemove)
        );
        console.log("[HUH]", JSON.stringify(contacts, null, 2));
        removeDeviceFromRecipients(deviceId);
        res.json({ success: true });
    });

    // Remove a contact entirely
    router.delete('/:contactId', (req, res) => {
        delete contacts[req.params.contactId];
        res.json({ success: true });
    });

    // List all devices (flat list, for easy recipient selection)
    router.get('/devices', (req, res) => {
        const onlyPublic = req.query.public === 'true';
        let allDevices = [];
        for (const contact of Object.values(contacts)) {
            for (const device of contact.devices) {
                if (!onlyPublic || device.public) {
                    allDevices.push({
                        contactId: contact.id,
                        contactName: contact.name,
                        deviceId: device.id,
                        deviceName: device.name,
                        public: device.public,
                        platform: device.platform,
                    });
                }
            }
        }
        res.json(allDevices);
    });

    // Update public/private status for a device
    router.patch('/:contactId/devices/:deviceId', (req, res) => {
        const { contactId, deviceId } = req.params;
        const contact = contacts[contactId];
        if (!contact) return res.status(404).json({ error: 'Contact not found' });
        const device = contact.devices.find(deviceObj => String(deviceObj.id) === String(deviceId));
        if (!device) return res.status(404).json({ error: 'Device not found' });
        if (typeof req.body.public === 'boolean') {
            device.public = req.body.public;
        }
        res.json({ success: true, device });
    });

    // Update a device's push subscription
    router.patch('/:contactId/devices/:deviceId/subscription', (req, res) => {
        const { contactId, deviceId } = req.params;
        const { subscription } = req.body;
        const contact = contacts[contactId];
        if (!contact) return res.status(404).json({ error: 'Contact not found' });
        const device = contact.devices.find(deviceObj => String(deviceObj.id) === String(deviceId));
        if (!device) return res.status(404).json({ error: 'Device not found' });
        if (subscription) {
            device.subscription = subscription;
            res.json({ success: true });
        } else {
            res.status(400).json({ error: 'Missing subscription' });
        }
    });

    return router;
}

// Export the contacts router factory and contacts store
module.exports = createContactsRouter;
module.exports.contacts = contacts;
