<template>
  <div>
    <div class="mb-2">
      <label class="fw-bold">Add Recipient:</label>
    </div>
    <div class="d-flex mb-2 gap-2">
      <select v-model="selectedUserId" class="form-select" style="max-width:200px;">
        <option disabled value="">Select User…</option>
        <option v-for="user in users" :key="user.id" :value="user.id">{{ user.username }}</option>
      </select>
      <template v-if="selectedUser">
        <div>
          <span
            v-for="device in devicesForSelectedUser"
            :key="device.id"
            class="form-check form-check-inline"
          >
            <input
              type="checkbox"
              class="form-check-input"
              :id="'device-' + device.id"
              :checked="recipientExistsForDevice(device.id)"
              @change="onDeviceCheckboxChange(device.id, $event)"
            >
            <label class="form-check-label" :for="'device-' + device.id">
              {{ device.name || device.id }}
              <span v-if="recipientExistsForDevice(device.id)" class="text-muted" style="font-size:0.8em;">(added)</span>
            </label>
          </span>
        </div>
      </template>
    </div>
  </div>
</template>

<script>
// Import socket.io client the same way you do elsewhere in your app
import { io } from 'socket.io-client';
const socket = io(window.location.origin, { path: '/socket.io', transports: ['websocket', 'polling'] });

export default {
  name: 'RecipientsSelector',
  props: {
    timerId: { type: [Number, String], required: true }
  },
  data() {
    return {
      users: [],
      recipients: [],
      selectedUserId: '',
      devicesForSelectedUser: [],
      loading: false
    }
  },
  computed: {
    selectedUser() {
      return this.users.find(user => user.id === this.selectedUserId);
    }
  },
  watch: {
    async selectedUserId(userId) {
      if (userId) {
        const res = await fetch(`/api/users/${userId}/devices`);
        this.devicesForSelectedUser = await res.json();
      } else {
        this.devicesForSelectedUser = [];
      }
    }
  },
  async mounted() {
    this.loading = true;
    // Fetch users
    const usersRes = await fetch('/api/users');
    this.users = await usersRes.json();
    // Fetch initial recipients
    await this.fetchRecipients();

    // Listen for real-time updates via socket.io
    socket.on('smart-timer-update', this.handleSmartTimerUpdate);
    this.loading = false;
  },
  beforeUnmount() {
    socket.off('smart-timer-update', this.handleSmartTimerUpdate);
  },
  methods: {
    async fetchRecipients() {
      const res = await fetch(`/api/smart-timers/${this.timerId}/recipients`);
      this.recipients = await res.json();
    },
    recipientExistsForDevice(deviceId) {
      // Assumes each recipient in recipients has deviceId (may be string or number)
      return this.recipients.some(r =>
        String(r.deviceId) === String(deviceId) &&
        String(r.userId) === String(this.selectedUserId)
      );
    },
    async onDeviceCheckboxChange(deviceId, event) {
      const userId = this.selectedUserId;
      if (!userId) return;
      // Add
      if (event.target.checked) {
        await fetch(`/api/smart-timers/${this.timerId}/recipients`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            deviceId,
            type: 'webpush',
            target: deviceId // placeholder, could be more specific if you use MQTT/email/etc later
          })
        });
        // No local update! Wait for socket event to update recipients
      }
      // Remove
      else {
        // Find the recipient entry to delete (match on userId/deviceId)
        const rec = this.recipients.find(r =>
          String(r.deviceId) === String(deviceId) &&
          String(r.userId) === String(userId)
        );
        if (rec) {
          await fetch(`/api/smart-timers/${this.timerId}/recipients/${rec.id}`, {
            method: 'DELETE'
          });
          // No local update! Wait for socket event
        }
      }
    },
    handleSmartTimerUpdate(timer) {
      if (String(timer.id) === String(this.timerId)) {
        this.recipients = timer.recipients || [];
        this.$emit('recipients-change', this.recipients);
      }
    }
  }
}
</script>

<style scoped>
.form-check-inline {
  margin-right: 10px;
}
</style>
