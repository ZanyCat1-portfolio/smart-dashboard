<template>
  <div>
    <div class="mb-2">
      <label class="fw-bold">Add Recipient:</label>
    </div>
    <div class="d-flex mb-2 gap-2">
      <select v-model="selectedContactId" class="form-select" style="max-width:200px;">
        <option disabled value="">Select Contact…</option>
        <option v-for="contact in contacts" :key="contact.id" :value="contact.id">{{ contact.name }}</option>
      </select>
      <template v-if="selectedContact">
        <div>
          <span v-for="device in devicesForSelectedContact" :key="device.id" class="form-check form-check-inline">
            <input
              type="checkbox"
              class="form-check-input"
              :id="'device-' + device.id"
              :checked="isDeviceAlreadyAdded(selectedContact.id, device.id) || selectedDeviceIds.includes(device.id)"
              :disabled="isDeviceAlreadyAdded(selectedContact.id, device.id)"
              @change="onDeviceCheckboxChange(device.id, $event)"
            >
            <label class="form-check-label" :for="'device-' + device.id">
              {{ device.device_name || device.id }}
              <span v-if="isDeviceAlreadyAdded(selectedContact.id, device.id)" class="text-muted" style="font-size:0.8em;">(already added)</span>
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
        :key="recipient.contactId"
        class="list-group-item"
      >
        <span>
          <b>{{ recipient.contactName }}</b>:
          <span
            v-for="device in recipient.devices"
            :key="device.id"
            class="badge bg-primary ms-1"
          >
            {{ device.name || device.id }}
            <button
              class="btn btn-sm btn-close btn-close-white ms-2"
              style="font-size:0.6em;vertical-align:middle;"
              aria-label="Remove"
              @click="removeDevice(recipient.contactId, device.id)"
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
    recipients: { type: Array, default: () => [] },
    contacts: { type: Array, required: true }
  },
  data() {
    return {
      selectedContactId: '',
      selectedDeviceIds: [],
      localRecipients: [],
      devicesForSelectedContact: []
    }
  },
  computed: {
    selectedContact() {
      return this.contacts.find(contact => contact.id === this.selectedContactId);
    }
  },
  watch: {
    selectedContactId: {
      immediate: true,
      async handler(contactId) {
        if (contactId) {
          // Fetch devices from your API for this contactId
          console.log("what is contactId in RecipSelec.vue: ", contactId)
          const res = await fetch(`/api/contacts/${contactId}/devices`)
          this.devicesForSelectedContact = await res.json();
        } else {
          this.devicesForSelectedContact = [];
        }
      }
    },
    recipients: {
      immediate: true,
      handler(newRecipients) {
        this.localRecipients = Array.isArray(newRecipients) ? JSON.parse(JSON.stringify(newRecipients)) : [];
        // console.log('localRecipients updated', this.localRecipients);
      }
    },
  },
  methods: {
    // Remove any devices from selection that are already added
    syncSelectedDeviceIds() {
      if (!this.selectedContact) {
        this.selectedDeviceIds = [];
        return;
      }
      this.selectedDeviceIds = this.selectedDeviceIds.filter(
        deviceId => !this.isDeviceAlreadyAdded(this.selectedContact.id, deviceId)
      );
    },
    // Checks if device is already added for this contact
    isDeviceAlreadyAdded(contactId, deviceId) {
      const recipient = this.localRecipients.find(
        rec => String(rec.contactId) === String(contactId)
      );
      const isAlreadyAdded = recipient && recipient.devices.some(device => String(device.id) === String(deviceId));
      // console.log('isDeviceAlreadyAdded?', contactId, deviceId, '=>', isAlreadyAdded, recipient ? recipient.devices : 'NO RECIPIENT');
      return isAlreadyAdded;
    },
    // Checkbox handler for device selection
    onDeviceCheckboxChange(deviceId, event) {
      if (event.target.checked) {
        if (!this.selectedDeviceIds.includes(deviceId)) {
          this.selectedDeviceIds.push(deviceId);
        }
      } else {
        this.selectedDeviceIds = this.selectedDeviceIds.filter(id => id !== deviceId);
      }
    },
    // Add the selected recipient and device(s)
    async addRecipient() {
      // 1. Validate input
      if (!this.selectedContactId || this.selectedDeviceIds.length === 0) return;
      const contact = this.selectedContact;
      if (!contact || !contact.id) return;

      // 2. For each device, POST to the backend API to add this recipient/device to the timer
      // (Assuming you have a prop: timerId)
      try {
        for (const deviceId of this.selectedDeviceIds) {

          const alreadyExists = this.recipients.some(
            rec => rec.contact_id == contact.id && rec.device_id == deviceId
          );
          if (alreadyExists) continue; // skip duplicates

          await fetch(`/api/timers/${this.timerId}/recipients`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contactId: contact.id,
              deviceId, // or null for all devices for this contact
            })
          });
        }

        // 3. After adding, fetch the current recipient list from the backend (source of truth)
        const resp = await fetch(`/api/timers/${this.timerId}/recipients`);
        const recipients = await resp.json();

        // 4. Emit the new recipients array to the parent (for UI display)
        this.$emit('recipients-change', recipients);

        // 5. Reset selections for next use
        this.selectedContactId = '';
        this.selectedDeviceIds = [];
      } catch (error) {
        console.error('Failed to add recipient:', error);
        // Optionally: show an error to the user here
      }
    },
    // Remove a device from a recipient
    removeDevice(contactId, deviceId) {
      const recipientIndex = this.localRecipients.findIndex(recipient => recipient.contactId == contactId);
      if (recipientIndex !== -1) {
        this.localRecipients[recipientIndex].devices = this.localRecipients[recipientIndex].devices.filter(
          device => String(device.id) !== String(deviceId)
        );
        // If no devices left, remove the recipient
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
