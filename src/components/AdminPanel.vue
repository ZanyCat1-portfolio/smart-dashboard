<template>
  <div class="container mt-5">
      <button class="btn btn-secondary mb-3" @click="exit">
        ← Back to Dashboard
    </button>
    <h2>Admin Panel</h2>
    <div>
      <h3>Users</h3>
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
          <tr v-for="user in users" :key="user.id">
            <td>{{ user.id }}</td>
            <td>{{ user.name }}</td>
            <td>
              <ul>
                <li v-for="device in user.devices" :key="device.id">
                  {{ device.name }} ({{ device.id }})
                  <button class="btn btn-sm btn-danger ms-2"
                    @click="deleteDevice(device.id)">
                    Delete Device
                  </button>
                </li>
              </ul>
            </td>
            <td>
              <button class="btn btn-danger btn-sm"
                @click="deleteUser(user.id)">
                Delete User
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
            <td>{{ device.name }}</td>
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
import { frontendFetch } from '../utils/utils';
export default {
  props: {
    exit: Function,
    reloadTimers: Function,
    timers: Array,
  },
  name: 'AdminPanel',
  data() {
    return {
      users: [],
      devices: [],
    };
  },
  async mounted() {
    await this.fetchUsers();
    await this.fetchDevices();
  },
  methods: {
    async fetchUsers() {
      const res = await frontendFetch('/api/users');
      this.users = await res.json();
    },
    async fetchDevices() {
      const res = await frontendFetch('/api/devices')
      this.devices = await res.json();
    },
    async deleteUser(userId) {
      if (!confirm('Delete this user and all its devices?')) return;
      await frontendFetch(`/api/users/${userId}`, { method: 'DELETE' });
      await this.fetchUsers();
      await this.fetchDevices();
    },
    async deleteDevice(deviceId) {
      await frontendFetch(`/api/devices/${deviceId}`, { method: 'DELETE' });
      await this.fetchDevices();
    },
    // Remove timer from local array if not in DB
    async deleteTimer(timerId) {
      await frontendFetch(`/api/smart-timers/${timerId}/cancel`, { method: 'POST' });
      this.reloadTimers();
    }
  },
};
</script>

<style scoped>
.container { max-width: 900px; }
</style>
