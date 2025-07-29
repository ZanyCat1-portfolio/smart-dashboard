<template>
  <div v-if="!isRegistered" class="device-registration">
    <!-- Registration Form (unchanged) -->
    <h2>Register This Device</h2>
    <form @submit.prevent="registerDevice">
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

  <div v-if="isRegistered" class="device-unregister">
    <p>
      This device is registered as:
      <b>{{ registeredAs }}</b>
    </p>
    <button class="btn btn-danger" @click="unregisterDevice" :disabled="unregistering">
      Unregister Device
    </button>
    <div v-if="unregisterSuccess" class="text-success mt-3">Device unregistered!</div>
    <div v-if="unregisterError" class="text-danger mt-3">{{ unregisterError }}</div>
  </div>
</template>

<script>
import { computed } from 'vue';
export default {
  props: {
    user: { type: Object, required: true },
    devicesApi: { type: Object, required: true },
    usersApi: { type: Object, required: true },
  },
  data() {
    return {
      deviceName: '',
      isPublic: false,
      registering: false,
      success: false,
      error: null,
      // registeredAs: '',
      alreadyRegistered: false,
      unregistering: false,
      unregisterSuccess: false,
      unregisterError: null,
    };
  },
  computed: {
    // Device composables maintains registration state
    isRegistered() {
      return !!this.devicesApi.currentDevice;
    },
    registeredAs() {
      // Show device name, or fallback if not registered
      return this.devicesApi.currentDevice?.name || 'FALLBACK HA'
    }
  },
  async mounted() {
    try {
      const subscription = await this.getPushSubscription();
      const endpoint = subscription.endpoint;

      // POST to /api/devices/find as before
      const res = await fetch('/api/devices/find', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint })
      });
      if (res.ok) {
        const device = await res.json();
        if (device && device.name && device.active) {
          // Update the in-mem db, key by id
          this.devicesApi.devices[device.id] = device;
          this.alreadyRegistered = true;
        } else {
          // Remove from in-mem if not active
          if (device && device.id) delete this.devicesApi.devices[device.id];
          this.alreadyRegistered = false;
        }
      } else {
        this.alreadyRegistered = false;
      }
    } catch (error) {
      this.alreadyRegistered = false;
    }
  },



  methods: {
    async registerDevice() {
      this.error = null;
      this.success = false;
      this.registering = true;
      try {
        await this.devicesApi.registerOrUpdateDevice({
          user: this.user,
          deviceName: this.deviceName,
          isPublic: this.isPublic,
        });
        this.success = true;
      } catch (e) {
        this.error = e.message || 'Failed to register device';
      } finally {
        this.registering = false;
      }
    },
    async unregisterDevice() {
      this.unregisterError = null;
      this.unregistering = true;
      this.unregisterSuccess = false;
      try {
        await this.devicesApi.unregisterDevice({ user: this.user });
        this.unregisterSuccess = true;
      } catch (e) {
        this.unregisterError = e.message || 'Failed to unregister device';
      } finally {
        this.unregistering = false;
      }
    },

    // async unregisterDevice() {
    //   this.error = null;
    //   this.unregistering = true;
    //   this.unregisterSuccess = false;
    //   this.unregisterError = null;

    //   try {
    //     // Get push subscription and endpoint
    //     const subscription = await this.getPushSubscription();
    //     const endpoint = subscription.endpoint;

    //     // Use devicesApi to find the device by endpoint (you may want a helper in the composable)
    //     const device = await this.devicesApi.findDeviceByEndpoint(endpoint);
    //     if (!device || !device.id) throw new Error('Device not found');

    //     // Use composable to deactivate device
    //     await this.devicesApi.deactivateDevice(device.id);

    //     // UI state only
    //     this.registeredAs = '';
    //     this.alreadyRegistered = false;
    //     this.unregisterSuccess = true;
    //     // No $emit here!
    //   } catch (error) {
    //     this.unregisterError = error.message || 'Failed to unregister device.';
    //   } finally {
    //     this.unregistering = false;
    //   }
    // },

    // async getPushSubscription() {
    //   if (!('serviceWorker' in navigator)) throw new Error('Service Worker not supported');
    //   if (!('PushManager' in window)) throw new Error('Push not supported in this browser');
      
    //   // Use the same registration as in main.js
    //   const swReg = await navigator.serviceWorker.ready;

    //   // Request notification permission
    //   const permission = await Notification.requestPermission();
    //   if (permission !== 'granted') throw new Error('Notification permission denied');

    //   // Get your VAPID public key from the backend
    //   const resp = await fetch('/api/vapid-public-key');
    //   if (!resp.ok) throw new Error('Failed to get VAPID key');
    //   const publicVapidKey = await resp.text();

    //   function urlBase64ToUint8Array(base64String) {
    //     const padding = '='.repeat((4 - base64String.length % 4) % 4);
    //     const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    //     const rawData = window.atob(base64);
    //     return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
    //   }

    //   // Subscribe for push
    //   const subscription = await swReg.pushManager.subscribe({
    //     userVisibleOnly: true,
    //     applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
    //   });
    //   return subscription;
    // },

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
