<template>
  <div class="container mt-5">
      <button class="btn btn-secondary mb-3" @click="exit">
        ← Back to Dashboard
    </button>
    <h2>Admin Panel</h2>
    <div>
      <h3>Contacts</h3>
      <table class="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Devices</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="contact in contacts" :key="contact.id">
            <td>{{ contact.id }}</td>
            <td>{{ contact.name }}</td>
            <td>
              <ul>
                <li v-for="device in contact.devices" :key="device.id">
                  {{ device.device_name }} ({{ device.id }})
                  <button class="btn btn-sm btn-danger ms-2"
                    @click="deleteDevice(device.id)">
                    Delete Device
                  </button>
                </li>
              </ul>
            </td>
            <td>
              <button class="btn btn-danger btn-sm"
                @click="deleteContact(contact.id)">
                Delete Contact
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <h3>Orphaned Devices</h3>
      <table class="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Device Name</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="device in devices" :key="device.id">
            <td>{{ device.id }}</td>
            <td>{{ device.device_name }}</td>
            <td>
              <button class="btn btn-sm btn-danger ms-2"
                @click="deleteDevice(device.id)">
                Delete Device
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <!-- Add similar blocks for Timers, Timer History, etc. as needed -->
  </div>
</template>

<script>
export default {
  props: {
    exit: Function,
    reloadTimers: Function,
    timers: Array,
  },
  name: 'AdminPanel',
  data() {
    return {
      contacts: [],
      devices: [],
    };
  },
  async mounted() {
    await this.fetchContacts();
    await this.fetchDevices();
  },
  methods: {
    async fetchContacts() {
      const res = await fetch('/api/contacts');
      this.contacts = await res.json();
    },
    async fetchDevices() {
      const res = await fetch('/api/contacts/devices')
      this.devices = await res.json();
    },
    async deleteContact(contactId) {
      if (!confirm('Delete this contact and all its devices?')) return;
      await fetch(`/api/contacts/${contactId}`, { method: 'DELETE' });
      await this.fetchContacts();
      await this.fetchDevices();
    },
    async deleteDevice(deviceId) {
      console.log("PRESSED DELETE BUTTON IN ADMIT PANEL")
      await fetch(`/api/contacts/devices/${deviceId}`, { method: 'DELETE' });
      await this.fetchDevices();
    },
    // Remove timer from local array if not in DB
    async deleteTimer(timerId) {
      const timer = this.timers.find(t => t.id === timerId);
      await fetch(`/api/timers/${timerId}/cancel`, { method: 'POST' });
      this.reloadTimers();    
    }
  },
};
</script>

<style scoped>
.container { max-width: 900px; }
</style>
