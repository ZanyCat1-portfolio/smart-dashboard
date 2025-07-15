<template>
  <div>
    <div class="mb-2">
      <label class="fw-bold">Add Recipient:</label>
    </div>
    <div class="d-flex mb-2 gap-2">
      <select v-model="selectedUserId" class="form-select" style="max-width:200px;">
        <option disabled value="">Select User…</option>
        <option v-for="user in users" :key="user.id" :value="user.id">{{ user.name }}</option>
      </select>
      <template v-if="selectedUser">
        <div>
          <span v-for="device in devicesForSelectedUser" :key="device.id" class="form-check form-check-inline">
            <input
              type="checkbox"
              class="form-check-input"
              :id="'device-' + device.id"
              :checked="isDeviceAlreadyAdded(selectedUser.id, device.id) || selectedDeviceIds.includes(device.id)"
              :disabled="isDeviceAlreadyAdded(selectedUser.id, device.id)"
              @change="onDeviceCheckboxChange(device.id, $event)"
            >
            <label class="form-check-label" :for="'device-' + device.id">
              {{ device.name || device.device_name || device.id }}
              <span v-if="isDeviceAlreadyAdded(selectedUser.id, device.id)" class="text-muted" style="font-size:0.8em;">(already added)</span>
            </label>
          </span>
          <button class="btn btn-outline-success btn-sm ms-2"
            :disabled="selectedDeviceIds.length === 0"
            @click.prevent="addRecipient"
          >Add</button>
        </div>
      </template>
    </div>
    <ul class="list-group mt-2">
      <li
        v-for="recipient in localRecipients"
        :key="recipient.userId"
        class="list-group-item"
      >
        <span>
          <b>{{ recipient.userName }}</b>:
          <span
            v-for="device in recipient.devices"
            :key="device.id"
            class="badge bg-primary ms-1"
          >
            {{ device.name || device.device_name || device.id }}
            <button
              class="btn btn-sm btn-close btn-close-white ms-2"
              style="font-size:0.6em;vertical-align:middle;"
              aria-label="Remove"
              @click="removeDevice(recipient.userId, device.id)"
              title="Remove device"
            ></button>
          </span>
        </span>
      </li>
    </ul>
  </div>
</template>

<script>
export default {
  name: 'RecipientsSelector',
  props: {
    timerId: { type: [Number, String], required: true },
    recipients: { type: Array, default: () => [] }
  },
  data() {
    return {
      users: [],
      selectedUserId: '',
      selectedDeviceIds: [],
      localRecipients: [],
      devicesForSelectedUser: []
    }
  },
  computed: {
    selectedUser() {
      return this.users.find(user => user.id === this.selectedUserId);
    }
  },
  watch: {
    selectedUserId: {
      immediate: true,
      async handler(userId) {
        if (userId) {
          const res = await fetch(`/api/users/${userId}/devices`);
          this.devicesForSelectedUser = await res.json();
        } else {
          this.devicesForSelectedUser = [];
        }
      }
    },
    recipients: {
      immediate: true,
      handler(newRecipients) {
        this.localRecipients = Array.isArray(newRecipients) ? JSON.parse(JSON.stringify(newRecipients)) : [];
      }
    },
  },
  async mounted() {
    // Fetch list of users
    const res = await fetch('/api/users');
    this.users = await res.json();
  },
  methods: {
    syncSelectedDeviceIds() {
      if (!this.selectedUser) {
        this.selectedDeviceIds = [];
        return;
      }
      this.selectedDeviceIds = this.selectedDeviceIds.filter(
        deviceId => !this.isDeviceAlreadyAdded(this.selectedUser.id, deviceId)
      );
    },
    isDeviceAlreadyAdded(userId, deviceId) {
      const recipient = this.localRecipients.find(
        rec => String(rec.userId) === String(userId)
      );
      const isAlreadyAdded = recipient && recipient.devices.some(device => String(device.id) === String(deviceId));
      return isAlreadyAdded;
    },
    onDeviceCheckboxChange(deviceId, event) {
      if (event.target.checked) {
        if (!this.selectedDeviceIds.includes(deviceId)) {
          this.selectedDeviceIds.push(deviceId);
        }
      } else {
        this.selectedDeviceIds = this.selectedDeviceIds.filter(id => id !== deviceId);
      }
    },
    async addRecipient() {
      if (!this.selectedUserId || this.selectedDeviceIds.length === 0) return;
      const user = this.selectedUser;
      if (!user || !user.id) return;

      try {
        for (const deviceId of this.selectedDeviceIds) {
          const alreadyExists = this.recipients.some(
            rec => rec.user_id == user.id && rec.device_id == deviceId
          );
          if (alreadyExists) continue;

          await fetch(`/api/smart-timer/${this.timerId}/recipients`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.id,
              deviceId,
              type: 'push',        // Change if you have different types
              target: deviceId     // Or user.email etc. if needed
            })
          });
        }

        // Refresh recipients from backend
        const resp = await fetch(`/api/smart-timer/${this.timerId}/recipients`);
        const recipients = await resp.json();

        this.$emit('recipients-change', recipients);
        this.selectedUserId = '';
        this.selectedDeviceIds = [];
      } catch (error) {
        console.error('Failed to add recipient:', error);
      }
    },
    removeDevice(userId, deviceId) {
      const recipientIndex = this.localRecipients.findIndex(recipient => recipient.userId == userId);
      if (recipientIndex !== -1) {
        this.localRecipients[recipientIndex].devices = this.localRecipients[recipientIndex].devices.filter(
          device => String(device.id) !== String(deviceId)
        );
        if (this.localRecipients[recipientIndex].devices.length === 0) {
          this.localRecipients.splice(recipientIndex, 1);
        }
        this.$emit('change', JSON.parse(JSON.stringify(this.localRecipients)));
      }
    }
  }
}
</script>

<style scoped>
.btn-close {
  font-size: 0.7rem;
  vertical-align: middle;
  margin-left: 0.5em;
}
</style>
