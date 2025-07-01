<template>
  <div>
    <div class="mb-2">
      <label class="fw-bold">Add Recipient:</label>
    </div>
    <div class="d-flex mb-2 gap-2">
      <select v-model="selectedContactId" class="form-select" style="max-width:200px;">
        <option disabled value="">Select Contact…</option>
        <option v-for="c in contacts" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
      <template v-if="selectedContact">
        <div>
          <span v-for="d in selectedContact.devices" :key="d.id" class="form-check form-check-inline">
            <input
              type="checkbox"
              class="form-check-input"
              :id="'device-' + d.id"
              v-model="selectedDeviceIds"
              :value="d.id"
            >
            <label class="form-check-label" :for="'device-' + d.id">
              {{ d.name || d.id }}
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
          <b>{{ recipient }}</b>:
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
      return this.contacts.find(c => String(c.id) === String(this.selectedContactId));
    }
  },
  watch: {
    recipients: {
      immediate: true,
      handler(newVal) {
        this.localRecipients = Array.isArray(newVal) ? JSON.parse(JSON.stringify(newVal)) : [];
      }
    }
  },
  methods: {
    
    addRecipient() {
      // Validate selection
      if (!this.selectedContactId || this.selectedDeviceIds.length === 0) return;
      const contact = this.selectedContact;
      if (!contact || !contact.id || !contact.name) {
        console.warn("No valid contact found for selectedContactId:", this.selectedContactId);
        return;
      }
      const devices = contact.devices.filter(d => this.selectedDeviceIds.includes(d.id));
      if (!devices.length) {
        console.warn("No devices matched selectedDeviceIds:", this.selectedDeviceIds, "in contact:", contact);
        return;
      }

      // Ensure all selected devices are valid (id and name at minimum)
      const validDevices = devices.filter(d => d && d.id && d.name);

      // Defensive: Only add recipients with both contactId, contactName, and valid devices array
      if (!validDevices.length) {
        console.warn("No valid devices found for contact:", contact);
        return;
      }

      // Debug log for sanity
      console.log("Adding recipient:", {
        contactId: contact.id,
        contactName: contact.name,
        devices: validDevices.map(d => ({ ...d }))
      });

      // Prevent duplicates: update devices array for the contact if exists
      const existing = this.localRecipients.find(r => r.contactId == contact.id);
      if (existing) {
        // Only add new devices
        const newDevices = validDevices.filter(
          d => !existing.devices.some(ed => String(ed.id) === String(d.id))
        );
        existing.devices = [...existing.devices, ...newDevices];
      } else {
        this.localRecipients.push({
          contactId: contact.id,
          contactName: contact.name,
          devices: validDevices.map(d => ({ ...d }))
        });
      }

      // Reset selections
      this.selectedContactId = '';
      this.selectedDeviceIds = [];
      this.$emit('change', JSON.parse(JSON.stringify(this.localRecipients)));
    },


    removeDevice(contactId, deviceId) {
      const idx = this.localRecipients.findIndex(r => r.contactId == contactId);
      if (idx !== -1) {
        // Remove the device from that contact's devices array
        this.localRecipients[idx].devices = this.localRecipients[idx].devices.filter(
          d => String(d.id) !== String(deviceId)
        );
        // If no devices left for the contact, remove the whole recipient entry
        if (this.localRecipients[idx].devices.length === 0) {
          this.localRecipients.splice(idx, 1);
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
