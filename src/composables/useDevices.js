// src/composables/useDevices.js
import { reactive, computed, ref } from 'vue';
import { getPushSubscription } from '../utils/push';

const devices = reactive({})
const base = import.meta.env.BASE_URL;

const currentDevice = computed(() => {
  const endpoint = localStorage.getItem('deviceEndpoint');
  // console.log("endpoint from localStorage:", endpoint);

  // Show all device endpoints for comparison
  Object.values(devices).forEach(d => {
    // console.log("device id:", d.id, "active:", d.active, "pushSubscription.endpoint:", d.pushSubscription?.endpoint);
  });

  // Show all matches
  const matching = Object.values(devices).filter(d => d.pushSubscription?.endpoint === endpoint);
  // console.log("devices with matching endpoint:", matching);

  // Show the first matching active device
  const result = Object.values(devices).find(
    d => d.active && d.pushSubscription?.endpoint === endpoint
  ) || null;
  // console.log("currentDevice result:", result);

  return result;
});


const visibleDevices = computed(() =>
  Object.values(devices).filter(d => d.active)
);

export function useDevices({ socket }) {

  // --- API methods ---

  async function fetchDevices() {
    const res = await fetch(`${base}api/devices`);
    if (!res.ok) throw new Error('Failed to fetch devices');
    const arr = await res.json();
    arr.forEach(d => devices[d.id] = d);
    return arr;
  }

  async function fetchDevicesByUser(userId) {
    const res = await fetch(`${base}api/devices?userId=${userId}`);
    if (!res.ok) throw new Error('Failed to fetch user devices');
    const arr = await res.json();
    arr.forEach(d => devices[d.id] = d);
    return arr;
  }

  async function getDeviceById(deviceId) {
    const res = await fetch(`${base}api/devices/${deviceId}`);
    if (!res.ok) throw new Error('Device not found');
    const device = await res.json();
    devices[device.id] = device;
    return device;
  }

  // Register a device if (userId, endpoint) is unique, else reactivate/update
  async function registerDevice({ userId, name, pushSubscription, platform = null }) {
    // console.log("THIS IS ME REGISTERING DEVICE")
    if (!userId || !pushSubscription?.endpoint) {
      throw new Error('userId and valid pushSubscription required');
    }
    // Try reactivate-or-register (preferred)
    const res = await fetch(`${base}api/devices/reactivate-or-register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, name, pushSubscription, platform }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to register device');
    }
    const device = await res.json();
    // devices[device.id] = device;
    localStorage.setItem('deviceEndpoint', pushSubscription.endpoint);
    // currentDevice.value = device;
    return device;
  }

  async function updateDevice(deviceId, data) {
    const res = await fetch(`${base}api/devices/${deviceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update device');
    const device = await res.json();
    // devices[device.id] = device;
    return device;
  }



  async function registerOrUpdateDevice({ user, deviceName }) {
    if (!user || !user.id) throw new Error('Valid user object required');
    // 1. Get pushSubscription
    const pushSubscription = await getPushSubscription(); // Define/Import this helper!
    const endpoint = pushSubscription?.endpoint;
    if (!endpoint) throw new Error('No push subscription endpoint.');

    // 2. Check for device by pushSubscription.endpoint in devices
    let device = Object.values(devices).find(
      d => d.pushSubscription?.endpoint === endpoint
    );

    // 3. If not found, check for device id in localStorage
    if (!device) {
      const localDeviceId = localStorage.getItem('deviceId');
      if (localDeviceId && devices[localDeviceId]) {
        device = devices[localDeviceId];
      }
    }

    // 4. If found, update it; else, register new device
    let resultDevice;
    if (device && device.id) {
      // Update existing
      resultDevice = await updateDevice(device.id, {
        userId: user.id,
        name: deviceName,
        pushSubscription,
        // platform: navigator.userAgent,
        active: true
      });
    } else {
      // Register new
      resultDevice = await registerDevice({
        userId: user.id,
        name: deviceName,
        pushSubscription,
        // platform: navigator.userAgent
      });
    }

    // 5. Save device id and pushSubscription to localStorage
    localStorage.setItem('deviceId', resultDevice.id);
    localStorage.setItem('deviceEndpoint', endpoint);

    return resultDevice;
  }


  async function unregisterDevice({ user }) {
    // TODO: Unregistering device needs to remove recipient from smartTimer
    
    if (!user || !user.id) throw new Error('Valid user object required');
    // 1. Try localStorage.deviceId first
    let deviceId = localStorage.getItem('deviceId');
    let device = deviceId && devices[deviceId] ? devices[deviceId] : null;

    // 2. If not found, fall back to current pushSubscription.endpoint
    if (!device) {
      const pushSubscription = await getPushSubscription();
      const endpoint = pushSubscription?.endpoint;
      if (!endpoint) throw new Error('No push subscription endpoint.');
      device = Object.values(devices).find(
        d => d.pushSubscription?.endpoint === endpoint
      );
    }

    // 3. If still not found, error
    if (!device || !device.id) throw new Error('Device not found');

    // 4. Deactivate device (active: false, clear push)
    await deactivateDevice(device.id);

    return true;
  }




  async function deactivateDevice(deviceId) {
    // Soft deactivation (active: false)
    const res = await fetch(`${base}api/devices/${deviceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: false }),
    });
    if (!res.ok) throw new Error('Failed to deactivate device');
    const device = await res.json();
    // devices[device.id] = device;
    // Optionally: clear currentDevice if matches
    if (currentDevice.value?.id === deviceId) currentDevice.value = null;
    return device;
  }

  async function deleteDevice(deviceId) {
    const res = await fetch(`${base}api/devices/${deviceId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete device');
    delete devices[deviceId];
    if (currentDevice.value?.id === deviceId) currentDevice.value = null;
  }

  // Find device by pushSubscription endpoint
  async function findDeviceByEndpoint(endpoint) {
    const res = await fetch(`${base}api/devices/find`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
    });
    if (!res.ok) return null;
    const device = await res.json();
    // console.log("device:created, device is:", device)
    // console.log("device:created, devices before update are:", devices)
    // devices[device.id] = device;
    // console.log("device:created, devices after update are:", devices)
    return device;
  }

  if (socket) {
      // Single device update (create, update, etc)
      socket.on('device:created', device => {
        // console.log("device:created, device is:", device)
        // console.log("device:created, devices before update are:", devices)
          devices[device.id] = device;
        // console.log("device:created, devices after update are:", devices)
      });
      socket.on('device:updated', device => {
        console.log("does socket.on device:updated fire?")
          devices[device.id] = device;
      });
      socket.on('device:deactivated', device => {
        console.log("does socket.on device:deactivated fire?")
          devices[device.id] = device;
      });
      socket.on('device:reactivated', device => {
        console.log("does socket.on device:reactivated fire?")
        // console.log("device:reactivated, device is:", device)
        // console.log("device:reactivated, devices before update are:", devices)
          devices[device.id] = device;
        // console.log("device:reactivated, devices after update are:", devices)
      });

      // Full devices snapshot (hydration)
      socket.on('devices:snapshot', (devicesArray) => {
        const arr = Array.isArray(devicesArray[0]) ? devicesArray[0] : devicesArray;
        Object.keys(devices).forEach(id => { delete devices[id]; });
        arr.forEach(device => {
            devices[device.id] = device;
        });
      });
  }


  // --- Public API ---
  return {
    devices,
    currentDevice,
    visibleDevices,
    fetchDevices,
    fetchDevicesByUser,
    getDeviceById,
    registerDevice,
    updateDevice,
    registerOrUpdateDevice,
    unregisterDevice,
    deactivateDevice,
    deleteDevice,
    findDeviceByEndpoint,
  };
}
