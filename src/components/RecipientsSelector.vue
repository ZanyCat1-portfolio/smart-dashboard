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
          <span v-for="device in selectedContact.devices" :key="device.id" class="form-check form-check-inline">
            <input
              type="checkbox"
              class="form-check-input"
              :id="'device-' + device.id"
              :checked="isDeviceAlreadyAdded(selectedContact.id, device.id) || selectedDeviceIds.includes(device.id)"
              :disabled="isDeviceAlreadyAdded(selectedContact.id, device.id)"
              @change="onDeviceCheckboxChange(device.id, $event)"
            >
            <label class="form-check-label" :for="'device-' + device.id">
              {{ device.name || device.id }}
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
    recipients: { type: Array, default: () => [] },
    contacts: { type: Array, required: true }
  },
  data() {
    return {
      selectedContactId: '',
      selectedDeviceIds: [],
      localRecipients: []
    }
  },
  computed: {
    selectedContact() {
      return this.contacts.find(contact => String(contact.id) === String(this.selectedContactId));
    }
  },
  watch: {
    recipients: {
      immediate: true,
      handler(newRecipients) {
        this.localRecipients = Array.isArray(newRecipients) ? JSON.parse(JSON.stringify(newRecipients)) : [];
        console.log('localRecipients updated', this.localRecipients);
      }
    },
    selectedContactId() {
      this.syncSelectedDeviceIds();
    }
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
      console.log('isDeviceAlreadyAdded?', contactId, deviceId, '=>', isAlreadyAdded, recipient ? recipient.devices : 'NO RECIPIENT');
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
    addRecipient() {
      if (!this.selectedContactId || this.selectedDeviceIds.length === 0) return;
      const contact = this.selectedContact;
      if (!contact || !contact.id || !contact.name) {
        console.warn("No valid contact found for selectedContactId:", this.selectedContactId);
        return;
      }

      // Only include devices not already present
      const selectedDevices = contact.devices.filter(
        device => this.selectedDeviceIds.includes(device.id)
      );
      if (!selectedDevices.length) return;

      // Only add valid devices
      const validDevices = selectedDevices.filter(device => device && device.id && (device.name || device.id));

      // Find or create recipient
      let recipient = this.localRecipients.find(rec => rec.contactId == contact.id);
      if (recipient) {
        // Merge new devices, avoiding duplicates
        const existingIds = new Set(recipient.devices.map(device => String(device.id)));
        const newDevices = validDevices.filter(device => !existingIds.has(String(device.id)));
        if (newDevices.length) {
          recipient.devices = [...recipient.devices, ...newDevices];
        }
      } else {
        this.localRecipients.push({
          contactId: contact.id,
          contactName: contact.name,
          devices: validDevices.map(device => ({ ...device }))
        });
      }

      // Remove any duplicate recipient for this contactId, merging devices if needed
      this.localRecipients = this.localRecipients.reduce((acc, recipientObj) => {
        const found = acc.find(existing => existing.contactId === recipientObj.contactId);
        if (!found) {
          acc.push(recipientObj);
        } else {
          // Merge devices
          const existingIds = new Set(found.devices.map(device => String(device.id)));
          const mergedDevices = [
            ...found.devices,
            ...recipientObj.devices.filter(device => !existingIds.has(String(device.id)))
          ];
          found.devices = mergedDevices;
        }
        return acc;
      }, []);

      // Force reactivity
      this.localRecipients = [...this.localRecipients];

      // Reset selections
      this.selectedContactId = '';
      this.selectedDeviceIds = [];

      console.log("Emitting recipients:", JSON.stringify(this.localRecipients, null, 2));
      this.$emit('recipients-change', JSON.parse(JSON.stringify(this.localRecipients)));
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
