<template>
  <div class="device-registration">
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
</template>

<script>
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map(char => char.charCodeAt(0)));
}

export default {
  data() {
    return {
      contactName: '',
      deviceName: '',
      isPublic: false,
      registering: false,
      success: false,
      error: null
    };
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
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to register');
        this.success = true;
      } catch (e) {
        this.error = e.message;
      } finally {
        this.registering = false;
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

    async handleDeviceRegister(form) {
        // form: { contactName, deviceName, isPublic, platform }
        const subscription = await registerPushSubscription();
        await fetch('/api/contacts/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
            ...form,
            subscription,
            // isPublic, platform, etc.
            }),
        });
    }

  }
}
</script>

