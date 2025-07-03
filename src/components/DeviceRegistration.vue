<template>
  <div v-if="!alreadyRegistered" class="device-registration">
    <h2>Register This Device</h2>
    <form @submit.prevent="registerDevice">
      <div>
        <label>Contact Name</label>
        <input v-model="contactName" required>
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
  data() {
    return {
      contactName: '',
      deviceName: '',
      isPublic: false,
      registering: false,
      success: false,
      error: null,
      registeredAs: '',
      alreadyRegistered: false
    };
  },
  mounted() {
    const reg = localStorage.getItem('registeredDevice');
    if (reg) {
      const info = JSON.parse(reg);
      this.registeredAs = `${info.contactName} / ${info.deviceName}`;
      this.alreadyRegistered = true;
    }
  },
  methods: {
    async registerDevice() {
      this.error = null;
      this.success = false;
      this.registering = true;
      try {
        const subscription = await this.getPushSubscription();
        const platform = navigator.userAgent || "unknown";

        const res = await fetch('/api/contacts/register', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            contactName: this.contactName,
            deviceName: this.deviceName,
            isPublic: this.isPublic,
            subscription,
            platform
          })
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Failed to register');
        this.success = true;

        // Get registered contact and device info from response
        const registeredContact = result.contact;
        // Find the new device (by subscription endpoint or last in array)
        let registeredDevice = registeredContact.devices.find(
          d => d.subscription && d.subscription.endpoint === subscription.endpoint
        );
        // Fallback: last device
        if (!registeredDevice) {
          registeredDevice = registeredContact.devices[registeredContact.devices.length - 1];
        }

        // Save to localStorage for unregister
        if (registeredContact && registeredDevice) {
          localStorage.setItem('registeredDevice', JSON.stringify({
            contactId: registeredContact.id,
            deviceId: registeredDevice.id,
            contactName: registeredContact.name,
            deviceName: registeredDevice.name
          }));
          this.registeredAs = `${registeredContact.name} (${registeredDevice.name})`;
          this.alreadyRegistered = true;
        } else {
          // If for any reason the response is malformed
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
        
        // Retrieve contactId and deviceId from localStorage (or component state)
        const registered = JSON.parse(localStorage.getItem('registeredDevice'));
        if (registered && registered.contactId && registered.deviceId) {
          console.log("await fetch/ what is URL?")
          console.log(`/api/contacts/${registered.contactId}/devices/${registered.deviceId}`)
          await fetch(`/api/contacts/${registered.contactId}/devices/${registered.deviceId}`, {
          // can we use base? we need to define it
          // await fetch(`${base}api/contacts/${registered.contactId}/devices/${registered.deviceId}`, {
            method: 'DELETE'
          });
        } else {
          throw new Error('Missing contact or device ID');
        }
        console.log("[HERE] getting here?")
        // Remove from localStorage and update state/UI
        localStorage.removeItem('registeredDevice');
        this.registeredAs = '';
        this.alreadyRegistered = false;
        this.$emit('device-unregistered');
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

      // Helper to decode base64url
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

    // Deprecated: handleDeviceRegister, kept for future expansion or refactor
    async handleDeviceRegister(form) {
      // form: { contactName, deviceName, isPublic, platform }
      const subscription = await this.getPushSubscription();
      await fetch('/api/contacts/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          subscription,
        }),
      });
    }
  }
}
</script>
