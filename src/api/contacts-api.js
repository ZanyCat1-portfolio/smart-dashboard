const express = require('express');
const contactsDAL = require('../dal/contacts-dal');
const devicesDAL = require('../dal/devices-dal');
// If you need to notify timers of device removal, you can require timersDAL or similar

function createContactsRouter(io) {
    const router = express.Router();

    // --- Register a new contact (with one device) ---
    router.post('/register', async (req, res) => {
        const { contactName, deviceName, subscription, isPublic, platform } = req.body;
        // isPublic is as expected here
        // console.log("what is isPublic: ", isPublic)
        if (!contactName || !deviceName || !subscription || !subscription.endpoint) {
            return res.status(400).json({ error: 'Missing fields or invalid subscription' });
        }

        try {
            // Find or create contact
            let contact = await contactsDAL.getContactByName(contactName);
            // if contact is undefined (false) enter if conditional
            if (!contact) {
                try {
                    const contactId = await contactsDAL.createContact(contactName);
                    contact = { id: contactId, name: contactName };
                } catch (error) {
                    // Catch unique constraint violation
                    if (error && error.message && error.message.includes('UNIQUE constraint failed')) {
                        return res.status(409).json({ error: 'Contact name already exists. Please choose a different name.' });
                    }
                    throw error; // rethrow if other error
                }
            }

            // Prevent device double registration (by endpoint)
            const devices = await devicesDAL.getDevicesByContactId(contact.id);
            if (devices.some(d => d.subscription && d.subscription.endpoint === subscription.endpoint)) {
                return res.status(409).json({ error: 'This device is already registered.' });
            }

            // Register device
            const deviceId = await devicesDAL.addDevice({
                contactId: contact.id,
                deviceName: deviceName,
                subscription: subscription,
                isPublic: !!isPublic,
                platform: platform || 'unknown'
            });

            // Return updated contact with all devices
            const updatedContact = await contactsDAL.getContactWithDevices(contact.id);
            io.emit('contact-registered', updatedContact);
            res.json({ success: true, contact: updatedContact });

        } catch (error) {
            console.error('[register error]', error);
            res.status(500).json({ error: 'Failed to register contact/device.' });
        }
    });

    // --- List all devices (flat) ---
    router.get('/:contactId/devices', async (req, res) => {
        try {
            const onlyPublic = req.query.public === 'true';
            let devices = await devicesDAL.getDevicesByContactId(req.params.contactId);
            if (onlyPublic) {
                devices = devices.filter(device => device.public);
            }
            res.json(devices);
        } catch (error) {
            console.error('[devices get]', error);
            res.status(500).json({ error: 'Failed to fetch devices.' });
        }
    });

    
    // --- Get device by deviceId ---
    router.get('/devices/:deviceId', async (req, res) => {
        const { deviceId } = req.params
        console.log("deviceId: ", deviceId)
        try {
            let device = await devicesDAL.getDeviceById(deviceId);
            res.json(device);
        } catch (error) {
            console.error('[devices get]', error);
            res.status(500).json({ error: 'Failed to fetch devices.' });
        }
    });

    // --- List all devices (flat) ---
    router.get('/devices', async (req, res) => {
        try {
            const onlyPublic = req.query.public === 'true';
            let devices = await devicesDAL.getAllDevices();
            if (onlyPublic) {
                devices = devices.filter(device => device.public);
            }
            res.json(devices);
        } catch (error) {
            console.error('[devices get]', error);
            res.status(500).json({ error: 'Failed to fetch devices.' });
        }
    });

    // --- List all contacts (with devices) ---
    router.get('/', async (req, res) => {
        try {
            const onlyPublic = req.query.public === 'true';
            let contacts = await contactsDAL.getAllContacts();
            if (onlyPublic) {
                contacts = contacts.map(contact => ({
                    ...contact,
                    devices: contact.devices.filter(device => device.public)
                })).filter(contact => contact.devices.length > 0);
            }
            res.json(contacts);
        } catch (error) {
            console.error('[contacts get]', error);
            res.status(500).json({ error: 'Failed to fetch contacts.' });
        }
    });
    
    // --- Delete a device from a contact ---
    router.delete('/:contactId/devices/:deviceId', async (req, res) => {
        const { contactId, deviceId } = req.params;
        try {
            const deleted = await devicesDAL.removeDeviceById(deviceId);
            res.json({ success: !!deleted });
        } catch (error) {
            console.error('[delete device]', error);
            res.status(500).json({ error: 'Failed to delete device.' });
        }
    });

    // Delete all devices from a contact
    router.delete('/:contactId/devices', async (req, res) => {
        try {
            await devicesDAL.removeDevicesByContact(req.params.contactId);
            res.json({ success: true });    
        } catch (error) {
            console.error('[delete all devices error]', error);
            res.status(500).json({ error: 'Failed to delete devices.' });
        }
    });

    // Delete a device by id
    router.delete('/devices/:deviceId', async (req, res) => {
        try {
            await devicesDAL.removeDeviceById(req.params.deviceId);
            res.json({ success: true });    
        } catch (error) {
            console.error('[delete device error]', error);
            res.status(500).json({ error: 'Failed to delete device.' });
        }
    });
    
    router.delete('/all', async (req, res) => {
        try {
            const deletedCount = await devicesDAL.removeAllDevices();
            res.json({ success: true, deleted: deletedCount });
        } catch (error) {
            console.error('[delete all devices]', error);
            res.status(500).json({ error: 'Failed to delete all devices.' });
        }
    });

    // --- Remove a contact entirely ---
    router.delete('/:contactId', async (req, res) => {
        const { contactId } = req.params;
        try {
            // Optionally, delete all devices for this contact too
            // our devices table cascasdes on delete though
            // await devicesDAL.deleteDevicesByContact(contactId);
            const deleted = await contactsDAL.removeContact(contactId);
            res.json({ success: !!deleted });
        } catch (error) {
            console.error('[delete contact]', error);
            res.status(500).json({ error: 'Failed to delete contact.' });
        }
    });

    // --- Update public/private status for a device ---
    router.patch('/:contactId/devices/:deviceId', async (req, res) => {
        const { deviceId } = req.params;
        const { public: isPublic } = req.body;
        try {
            const updated = await devicesDAL.updateDevicePublicStatus(deviceId, isPublic);
            const device = await devicesDAL.getDeviceById(deviceId);
            res.json({ success: !!updated, device });
        } catch (error) {
            console.error('[patch device public]', error);
            res.status(500).json({ error: 'Failed to update device.' });
        }
    });

    // --- Update a device's push subscription ---
    router.patch('/:contactId/devices/:deviceId/subscription', async (req, res) => {
        const { deviceId } = req.params;
        const { subscription } = req.body;
        try {
            if (!subscription) return res.status(400).json({ error: 'Missing subscription' });
            const updated = await devicesDAL.updateDeviceSubscription(deviceId, JSON.stringify(subscription));
            res.json({ success: !!updated });
        } catch (error) {
            console.error('[patch device sub]', error);
            res.status(500).json({ error: 'Failed to update subscription.' });
        }
    });

    router.post('/find-device', async (req, res) => {
        const { endpoint } = req.body;
        if (!endpoint) return res.status(400).json({ error: 'Missing endpoint.' });
        
        try {
            const device = await devicesDAL.getDeviceByEndpoint(endpoint);
            if (!device) return res.json({});
            const contact = await contactsDAL.getContactById(device.contact_id);
            if (!contact) return res.json({});
            res.json({
                contactName: contact.name,
                deviceName: device.device_name,
                contactId: contact.id,
                deviceId: device.id
            });
        } catch (error) {
            console.error('[find-device error]', error);
            res.status(500).json({ error: 'Failed to find device.' });
        }
    });

    return router;
}

module.exports = createContactsRouter;
