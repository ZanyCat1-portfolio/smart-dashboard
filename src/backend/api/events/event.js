// /api/events due to proxy-server.cjs and index.js .use statements

module.exports = (io) => {
    const express = require('express');
    const router = express.Router();

    router.post('/event', (req, res) => {
        console.log("Frontend event:", req.body);
        res.sendStatus(204);
    });

    return router;
}