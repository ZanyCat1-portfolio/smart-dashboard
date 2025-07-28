const { reactive } = require('vue');
const deviceDAL = require('../dal/device-dal');
const eventBus = require('../utils/eventBus');

const devices = reactive({});

function rehydrateDevices() {
  const allDevices = deviceDAL.listAllDevices();
  for (const key in devices) delete devices[key];
  allDevices.forEach(device => {
    devices[device.id] = device;
  });
  eventBus.emit('devices:snapshot', Object.values(devices));
}

rehydrateDevices();

module.exports = {
  devices,
  rehydrateDevices
} 
