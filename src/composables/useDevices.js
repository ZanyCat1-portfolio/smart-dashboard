// src/composables/useDevices.js
import { reactive, computed, ref } from 'vue';

const base = import.meta.env.BASE_URL;

const devices = reactive({});           // deviceId => device object
const currentDevice = computed(() =>
  Object.values(devices).find(d => d.active) || null
);

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
  async function registerDevice({ userId, name, pushSubscription, isPublic = false, platform = null }) {
    if (!userId || !pushSubscription?.endpoint) {
      throw new Error('userId and valid pushSubscription required');
    }
    // Try reactivate-or-register (preferred)
    const res = await fetch(`${base}api/devices/reactivate-or-register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, name, pushSubscription, isPublic, platform }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to register device');
    }
    const device = await res.json();
    devices[device.id] = device;
    currentDevice.value = device;
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
    devices[device.id] = device;
    return device;
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
    devices[device.id] = device;
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
    devices[device.id] = device;
    return device;
  }

  if (socket) {
      // Single device update (create, update, etc)
      socket.on('device:created', device => {
          devices[device.id] = device;
      });
      socket.on('device:updated', device => {
          devices[device.id] = device;
      });
      socket.on('device:deactivated', device => {
          devices[device.id] = device;
      });
      socket.on('device:reactivated', device => {
          devices[device.id] = device;
      });

      // Full devices snapshot (hydration)
      socket.on('devices:snapshot', (devicesArray) => {
          Object.keys(devices).forEach(id => { delete devices[id]; });
          devicesArray.forEach(device => {
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
    deactivateDevice,
    deleteDevice,
    findDeviceByEndpoint,
  };
}
