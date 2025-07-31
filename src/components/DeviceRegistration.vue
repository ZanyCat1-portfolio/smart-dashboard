<template>
  <div v-if="!isRegistered" class="device-registration">
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

  <div v-if="user && devicesApi.devices">
    <button class="btn btn-outline-secondary mb-2" @click="showDevices = !showDevices">
      {{ showDevices ? 'Hide' : 'See' }} Registered Devices ({{ userDevices.length }})
    </button>
    <div v-show="showDevices" class="registered-devices-list">
      <div v-if="userDevices.length === 0" class="text-muted">
        No devices registered.
      </div>
      <div v-for="device in userDevices" :key="device.id" class="device-row d-flex justify-content-between align-items-center mb-1">
        <span>
          <b>{{ device.name }}</b>
        </span>
        <button
          class="btn btn-sm btn-danger"
          @click="deactivateDevice(device)"
          :disabled="deactivating === device.id"
        >Deactivate</button>
      </div>
    </div>
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
      alreadyRegistered: false,
      unregistering: false,
      unregisterSuccess: false,
      unregisterError: null,
      showDevices: false,
      deactivating: null,
    };
  },
  computed: {
    isRegistered() {
      return !!this.devicesApi.currentDevice;
    },
    registeredAs() {
      return this.devicesApi.currentDevice?.name || 'FALLBACK HA'
    },
    userDevices() {
      return Object.values(this.devicesApi.devices)
        .filter(d => d.userId === this.user.id && d.active);
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
      const current = this.devicesApi.currentDevice;
      if (!current) throw new Error('No current device');
      await this.deactivateDevice(current)
    },

    async deactivateDevice(device) {
      this.deactivating = device.id;
      try {
        await this.devicesApi.deactivateDevice(device.id);
        device.active = false;
      } catch (e) {
        alert(e.message || "Failed to deactivate device");
      } finally {
        this.deactivating = null;
      }
    },
  }
}
</script>
