<template>
  <div class="recipient-selector">
    <div class="mb-2">
      <label class="fw-bold">Add Recipient:</label>
    </div>
    <div class="d-flex flex-column gap-2" style="align-items:flex-start;">
      <div class="select-user-wrapper">
        <select v-model="selectedUserId"
          class="form-select select-user"
          style="width:100%;"
          :tabindex="requireAuth && !sessionState.user ? -1 : 0"
        >
          <option disabled value="">Select User…</option>
          <option v-for="user in users" :key="user.id" :value="user.id">{{ user.username }}</option>
        </select>
      </div>

      <!-- Devices scrollable list, always shows at least 3 rows tall -->
      <div class="devices-list-container">
        <div class="devices-list">
          <template v-if="selectedUser">
            <div
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
                :tabindex="requireAuth && !sessionState.user ? -1 : 0"
              >
              <label class="form-check-label" :for="'device-' + device.id">
                {{ device.name || device.id }}
              </label>
            </div>
            <div v-if="devicesForSelectedUser.length === 0" class="no-devices">
              No devices registered.
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import socket from '../composables/useSocket'
import { state as sessionState } from '../composables/useSessions'


export default {
  name: 'RecipientsSelector',
  props: {
    timerId: { type: [Number, String], required: true },
    users: { type: Array, required: true },
    devices: { type: Array, required: true },
    recipients: { type: Array, default: () => [] },
    smartTimersApi: { type: Object, required: true },
    requireAuth: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      selectedUserId: '',
      loading: false,
      sessionState,
    }
  },
  computed: {
    selectedUser() {
      return this.users.find(user => user.id === this.selectedUserId);
    },
    devicesForSelectedUser() {
      return this.devices.filter(
        device => device.userId === this.selectedUserId && device.active
      );
    }
  },
  async mounted() {
    this.loading = true;
    socket.on('smart-timer-update', this.handleSmartTimerUpdate);
    this.loading = false;
  },
  beforeUnmount() {
    socket.off('smart-timer-update', this.handleSmartTimerUpdate);
  },
  methods: {
    recipientExistsForDevice(deviceId) {
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
        try {
          await this.smartTimersApi.addRecipient(this.timerId, userId, deviceId);
        } catch (err) {
          event.target.checked = false;
          alert('Failed to add recipient: ' + (err.message || 'Unknown error'))
        }
      }
      // Remove
      else {
        // Find the recipient entry to delete (match on userId/deviceId)
        const rec = this.recipients.find(r =>
          String(r.deviceId) === String(deviceId) &&
          String(r.userId) === String(userId)
        );
        if (rec) {
          try {
            await this.smartTimersApi.removeRecipient(this.timerId, rec.id)
          } catch (err) {
            event.target.checked = true;
            alert('Failed to remove recipient: ' + (err.message || 'Unknown error'))
          }
        }
      }
    },
    handleSmartTimerUpdate(timer) {
      if (String(timer.id) === String(this.timerId)) {
        this.$emit('recipients-change', this.recipients);
      }
    }
  }
}
</script>

<style scoped>
.recipient-selector {
  width: 100%;
}

.select-user-wrapper {
  /* Optionally add z-index for overlay behavior if needed */
  position: relative;
  width: 100%;
  min-width: 0
}

.select-user {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.devices-list-container {
  width: 100%;
  /* Always at least 3 devices tall, scroll if more */
  max-height: 5.5em; /* Approx 3 rows tall */
  min-height: 5.5em;
  overflow-y: auto;
  background: transparent;
  padding-bottom: 2px;
}

.devices-list {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.no-devices {
  min-height: 36px;
  color: #888;
  display: flex;
  align-items: center;
}

.form-check-inline {
  margin-right: 10px;
}
</style>
