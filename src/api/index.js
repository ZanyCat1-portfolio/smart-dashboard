// all urls start with /api due to proxy-server.cjs app.use statement

module.exports = (io) => {
    const express = require('express');
    const router = express.Router();

    const smartTimerApi = require('./smartTimer/smartTimer-api')(io);
    const deviceApi = require('./smartTimer/device-api')(io);
    const userApi = require('./smartTimer/user-api')(io);

    const exampleTasmotaApi = require('./tasmota/example-tasmota-api')(io);
    const tasmotaApi = require('./tasmota/tasmota-api')(io);

    const exampleGoveeApi = require('./govee/example-govee-api')(io);
    const goveeApi = require('./govee/govee-api')(io);

    router.use('/smart-timers', smartTimerApi);
    router.use('/devices', deviceApi);
    router.use('/users', userApi);

    router.use('/example-tasmota', exampleTasmotaApi);
    router.use('/tasmota', tasmotaApi);

    router.use('/example-govee', exampleGoveeApi);
    router.use('/govee', goveeApi);

    return router;
}
