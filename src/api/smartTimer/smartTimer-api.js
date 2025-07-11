const express = require('express');
const smartTimerDAL = require('../../dal/smartTimer-dal');
const recipientDAL = require('../../dal/recipient-dal');
const SmartTimer = require('../../models/SmartTimer');
const eventBus = require('../../utils/eventBus');

module.exports = (io) => {

  const router = express.Router();
  
  // Create new timer
  router.post('/', async (req, res) => {
    try {
      const timer = await smartTimerDAL.createSmartTimer(req.body);
      res.status(201).json(timer);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // List all timers (optional: ?state=active|paused|canceled|finished)
  router.get('/', async (req, res) => {
    try {
      const { state } = req.query;
      let timers;
      if (state) {
        timers = await smartTimerDAL.listSmartTimersByState(state);
      } else {
        timers = await smartTimerDAL.listAllSmartTimers();
      }
      res.json(timers);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Get timer by id
  router.get('/:id', async (req, res) => {
    try {
      const timer = await smartTimerDAL.getSmartTimerById(req.params.id);
      if (!timer) return res.status(404).json({ error: 'Not found' });
      res.json(timer);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Start timer
  router.post('/:id/start', async (req, res) => {
    try {
      const timer = await smartTimerDAL.setState(req.params.id, 'running');
      if (timer) eventBus.emit('timer:started', timer);
      res.json(timer);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Pause timer
  router.post('/:id/pause', async (req, res) => {
    try {
      const timer = await smartTimerDAL.setState(req.params.id, 'paused');
      if (timer) eventBus.emit('timer:paused', timer);
      res.json(timer);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Add time to timer
  router.post('/:id/add-time', async (req, res) => {
    try {
      const { seconds } = req.body;
      const timer = await smartTimerDAL.getSmartTimerById(req.params.id);
      if (!timer) return res.status(404).json({ error: 'Not found' });
      const updated = await smartTimerDAL.updateSmartTimer(timer.id, { duration: timer.duration + Number(seconds) });
      eventBus.emit('timer:addedTime', updated, Number(seconds));
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Cancel timer
  router.post('/:id/cancel', async (req, res) => {
    try {
      const timer = await smartTimerDAL.setState(req.params.id, 'canceled');
      if (timer) eventBus.emit('timer:canceled', timer);
      res.json(timer);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Finish timer
  router.post('/:id/finish', async (req, res) => {
    try {
      const timer = await smartTimerDAL.setState(req.params.id, 'finished');
      if (timer) eventBus.emit('timer:finished', timer);
      res.json(timer);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Add recipient to timer
  router.post('/:id/recipients', async (req, res) => {
    try {
      const timerId = req.params.id;
      const recipient = await recipientDAL.addRecipientToTimer(timerId, req.body);
      res.status(201).json(recipient);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Remove recipient from timer
  router.delete('/:id/recipients/:recipientId', async (req, res) => {
    try {
      await recipientDAL.removeRecipient(req.params.recipientId);
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // List recipients for timer
  router.get('/:id/recipients', async (req, res) => {
    try {
      const recipients = await recipientDAL.getRecipientsForTimer(req.params.id);
      res.json(recipients);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  return router;
}
