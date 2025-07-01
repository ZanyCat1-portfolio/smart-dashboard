// contacts-api.js
const express = require('express');

// In-memory store (replace with DB later)
let nextContactId = 1;
const contacts = {}; // contactId: { id, name, devices: [{ id, name, subscription, public, platform }] }

function createContactsRouter(io) {
    const router = express.Router();

    // Register a new contact (with one device)
    router.post('/register', (req, res) => {
        const { contactName, deviceName, subscription, isPublic, platform } = req.body;
        if (!contactName || !deviceName || !subscription) {
            return res.status(400).json({ error: 'Missing fields' });
        }

        // For now: one contact per name, or create new
        let contact = Object.values(contacts).find(c => c.name === contactName);
        if (!contact) {
            contact = { id: nextContactId++, name: contactName, devices: [] };
            contacts[contact.id] = contact;
        }

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
        let list = Object.values(contacts);
        if (onlyPublic) {
            // Return only devices marked as public
            list = list.map(c => ({
                ...c,
                devices: c.devices.filter(d => d.public)
            })).filter(c => c.devices.length > 0);
        }
        res.json(list);
    });

    // Delete a device from a contact
    router.delete('/:contactId/devices/:deviceId', (req, res) => {
        const { contactId, deviceId } = req.params;
        const contact = contacts[contactId];
        if (!contact) return res.status(404).json({ error: 'Contact not found' });

        contact.devices = contact.devices.filter(d => String(d.id) !== String(deviceId));
        res.json({ success: true });
    });

    // Remove a contact entirely
    router.delete('/:contactId', (req, res) => {
        delete contacts[req.params.contactId];
        res.json({ success: true });
    });

    // List all devices (flat list, for easy recipient selection)
    router.get('/devices', (req, res) => {
        // Optional: ?public=true to filter
        const onlyPublic = req.query.public === 'true';

        let allDevices = [];
        for (const contact of Object.values(contacts)) {
            for (const device of contact.devices) {
                // Attach contact info for context if desired
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

        const device = contact.devices.find(d => String(d.id) === String(deviceId));
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

        const device = contact.devices.find(d => String(d.id) === String(deviceId));
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

// Export both router creator and contacts reference
module.exports = createContactsRouter;
module.exports.contacts = contacts;
