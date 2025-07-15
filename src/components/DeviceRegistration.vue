<template>
  <div v-if="!alreadyRegistered" class="device-registration">
    <h2>Register This Device</h2>
    <form @submit.prevent="registerDevice">
      <div>
        <label>User Name</label>
        <input v-model="userName" required>
      </div>
      <div>
        <label>Device Name</label>
        <input v-model="deviceName" required>
      </div>
      <div>
        <label>
          <input type="checkbox" v-model="isPublic">
          Public (allow others to select this device for alerts)
        </label>
      </div>
      <button class="btn btn-primary" type="submit" :disabled="registering">Register Device</button>
    </form>
    <div v-if="success" class="text-success mt-3">Device registered successfully!</div>
    <div v-if="error" class="text-danger mt-3">{{ error }}</div>
  </div>
  <div v-else class="text-success mt-3">
    Device is already registered on this browser.
  </div>
  
  <div v-if="alreadyRegistered" class="device-unregister">
    <p>This device is registered as: <b>{{ registeredAs }}</b></p>
    <button class="btn btn-danger" @click="unregisterDevice" :disabled="unregistering">
      Unregister Device
    </button>
    <div v-if="unregisterSuccess" class="text-success mt-3">Device unregistered!</div>
    <div v-if="unregisterError" class="text-danger mt-3">{{ unregisterError }}</div>
    </div>
</template>

<script>
export default {
  emits: ['deviceUnregistered'],
  data() {
    return {
      userName: '',
      deviceName: '',
      isPublic: false,
      registering: false,
      success: false,
      error: null,
      registeredAs: '',
      alreadyRegistered: false
    };
  },
  async mounted() {
    try {
      // 1. Get the push subscription for this browser
      const subscription = await this.getPushSubscription();
      const endpoint = subscription.endpoint;
      // 2. Query backend for this device
      const res = await fetch('/api/devices/find', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint })
      });
      if (res.ok) {
        const device = await res.json();
        if (device && device.name) {
          this.registeredAs = device.name;
          this.alreadyRegistered = true;
        } else {
          this.registeredAs = '';
          this.alreadyRegistered = false;
        }
      } else {
        this.registeredAs = '';
        this.alreadyRegistered = false;
      }
    } catch (error) {
      // Fallback to unregistered state
      this.registeredAs = '';
      this.alreadyRegistered = false;
    }
  },

  methods: {
    async registerDevice() {
      this.error = null;
      this.success = false;
      this.registering = true;
      try {
        // If you only have userName, you need to resolve it to userId
        const userId = await this.resolveUserIdByName(this.userName);
        if (!userId) throw new Error('User not found. Please ensure the user exists.');

        const subscription = await this.getPushSubscription();
        const platform = navigator.userAgent || "unknown";

        const res = await fetch('/api/devices', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            userId,
            name: this.deviceName,
            pushSubscription: subscription,
            isPublic: this.isPublic,
            platform
          })
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Failed to register');
        this.success = true;

        // Get registered user and device info from response
        const registeredUser = result.user;
        const registeredDevice = result.device;

        // Save to localStorage for unregister
        if (registeredUser && registeredDevice) {
          localStorage.setItem('registeredDevice', JSON.stringify({
            userId: registeredUser.id,
            deviceId: registeredDevice.id,
            userName: registeredUser.name,
            deviceName: registeredDevice.name
          }));
          this.registeredAs = `${registeredUser.name} (${registeredDevice.name})`;
          this.alreadyRegistered = true;
        } else {
          this.error = 'Failed to save device registration info.';
        }
      } catch (error) {
        this.error = error.message;
      } finally {
        this.registering = false;
      }
    },
    async unregisterDevice() {
      this.error = null;
      try {
        // Retrieve userId and deviceId from localStorage (or component state)
        const registered = JSON.parse(localStorage.getItem('registeredDevice'));
        if (registered && registered.userId && registered.deviceId) {
          await fetch(`/api/devices/${registered.deviceId}`, {
            method: 'DELETE'
          });
        } else {
          throw new Error('Missing user or device ID');
        }
        // Remove from localStorage and update state/UI
        localStorage.removeItem('registeredDevice');
        this.registeredAs = '';
        this.alreadyRegistered = false;
        this.$emit('deviceUnregistered');
      } catch (error) {
        this.error = 'Failed to unregister device.';
      }
    },
    async getPushSubscription() {
      if (!('serviceWorker' in navigator)) throw new Error('Service Worker not supported');
      if (!('PushManager' in window)) throw new Error('Push not supported in this browser');
      
      // Use the same registration as in main.js
      const swReg = await navigator.serviceWorker.ready;

      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Notification permission denied');

      // Get your VAPID public key from the backend
      const resp = await fetch('/api/vapid-public-key');
      if (!resp.ok) throw new Error('Failed to get VAPID key');
      const publicVapidKey = await resp.text();

      function urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
      }

      // Subscribe for push
      const subscription = await swReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
      });
      return subscription;
    },

    // Utility: resolve user name to userId
    async resolveUserIdByName(name) {
      // This method fetches all users and returns the id for the first matching name.
      const res = await fetch('/api/users');
      const users = await res.json();
      const user = users.find(u => u.name === name);
      return user ? user.id : null;
    }
  }
}
</script>
