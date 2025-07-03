<template>
  <div :class="['container mt-4', theme]">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h1 class="display-4 text-primary">Smart Switch Dashboard</h1>
      <button @click="toggleTheme" class="btn btn-outline-secondary">
        <i :class="theme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-fill'"></i>
        {{ theme === 'dark' ? 'Light Mode' : 'Dark Mode' }}
      </button>
    </div>

    <DeviceRegistration @device-unregistered="onDeviceUnregistered" />

    <div v-if="isExampleFile" class="alert alert-warning">
      <i class="bi bi-exclamation-triangle"></i>
      {{ exampleInfo }}
    </div>

    <nav class="mb-4 sticky-nav">
      <ul class="nav nav-tabs">
        <li v-for="type in Object.keys(groupedDevices)" :key="type" class="nav-item">
          <a class="nav-link" href="#" @click.prevent="scrollToGroup(type)">
            {{ formatType(type) }}
          </a>
        </li>
      </ul>
    </nav>

    <div v-if="loadingDevices" class="text-center my-5">
      <div class="spinner-border text-primary" role="status" style="width:2rem; height:2rem;"></div>
      <p class="mt-2 text-muted">Loading devices…</p>
    </div>

    <div v-else>
      <div
        v-for="(devices, type) in groupedDevices"
        :key="type"
        :id="type"
        :ref="`group-${type}`"
        class="card mb-4"
        style="scroll-margin-top: 4rem;"
      >
        <div
          class="card-header d-flex justify-content-between align-items-center"
          @click="toggleGroup(type)"
          style="cursor: pointer;"
        >
          <h2 class="mb-0">{{ formatType(type) }}</h2>
          <span>
            <i v-if="openGroups[type]" class="bi bi-chevron-up"></i>
            <i v-else class="bi bi-chevron-down"></i>
          </span>
        </div>


        <div v-show="openGroups[type]" class="card-body">
          <!-- Timers group (dashboard timers only, uses new logic) -->
          <template v-if="type === 'timers'">
            <div class="mb-3 d-flex align-items-center gap-2">
              <button class="btn btn-success" @click="showTimerForm = !showTimerForm">
                <span v-if="!showTimerForm">+ Add Timer</span>
                <span v-else>Cancel</span>
              </button>
              <button class="btn btn-secondary" @click="showHistory">
                View Timer History
              </button>
            </div>
            <div v-if="showTimerForm" class="mb-4">
              <TimerCreateForm
                @create="addDashboardTimer"
                @cancel="showTimerForm = false"
              />
            </div>
            <div v-if="timers.length === 0" class="text-muted mb-3">
              No timers yet. Click <b>+ Add Timer</b> to create one.
            </div>
            <div class="row row-cols-1 row-cols-md-2 g-4">
              <div v-for="timer in timers" :key="timer.id" class="col">
                <TimerCard
                  :timer="timer"
                  :contacts="contacts"
                  @start="min => startDashboardTimer(timer, min)"
                  @add="min => addToDashboardTimer(timer, min)"
                  @cancel="() => cancelDashboardTimer(timer)"
                  @update-recipients="recips => updateTimerRecipients(timer, recips)"
                />

              </div>
            </div>
            <div v-if="showTimerHistory" class="mb-4">
              <div class="d-flex justify-content-between align-items-center">
                <h5 class="mb-0">Timer History</h5>
                <button class="btn btn-outline-secondary btn-sm" @click="showTimerHistory = false">
                  Close
                </button>
              </div>
              <div v-if="timerHistory.length === 0" class="mt-3 text-muted">No timer history yet.</div>
              <ul v-else class="list-group mt-3">
                <li v-for="timer in timerHistory" :key="timer.id" class="list-group-item d-flex justify-content-between align-items-center">
                  <span>
                    <b>{{ timer.name }}</b> 
                    <span v-if="timer.canceled" class="badge bg-warning text-dark ms-2">Canceled</span>
                    <span v-else class="badge bg-success ms-2">Completed</span>
                  </span>
                  <span>
                    <span class="text-muted">{{ formatDate(timer.lastAction || timer.created) }}</span>
                  </span>
                </li>
              </ul>
            </div>
          </template>







          <!-- All other device groups (Tasmota, Govee, etc.) use old logic untouched -->
          <template v-else>
            <div class="row row-cols-1 row-cols-md-2 g-4">
              <div v-for="device in devices" :key="device.endpoint" class="col">
                <component
                  :is="getCardComponent(device)"
                  :device="device"
                  :state="computedDeviceState(device.endpoint)"
                  :theme="theme"
                  :get-api-route="getApiRoute"
                  :timer-state="timerStates[device.endpoint]"
                  :timer-display="timerDisplays[device.endpoint]"
                  :on-start-timer="(minutes) => startDeviceTimer(device, minutes)"
                  :on-add-to-timer="(minutes) => addToDeviceTimer(device, minutes)"
                  :on-cancel-timer="() => cancelDeviceTimer(device)"
                  @refresh="fetchStatus(device)"
                />
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { io } from 'socket.io-client'
import TasmotaCard from './components/TasmotaCard.vue'
import GoveeCard from './components/GoveeCard.vue'
import TimerCard from './components/TimerCard.vue'
import TimerCreateForm from './components/TimerCreateForm.vue'
import { setDevtoolsHook } from 'vue'
import DeviceRegistration from './components/DeviceRegistration.vue'

const base = import.meta.env.BASE_URL

export default {
  name: 'App',
  components: { TimerCard, TimerCreateForm, TasmotaCard, GoveeCard, DeviceRegistration },
  data() {
    return {
      contacts: [],
      loadingDevices: true,
      devices: [],
      deviceStates: {},
      openGroups: {},
      theme: 'light',
      isExampleFile: false,
      exampleInfo: '',
      socket: null,
      timers: [],
      timerHistory: [],
      showTimerForm: false,
      showTimerHistory: false,
      timerStates: {},
      timerDisplays: {}
    }
  },
  computed: {
    groupedDevices() {
      const groups = this.devices.reduce((groups, device) => {
        (groups[device.type] = groups[device.type] || []).push(device)
        return groups
      }, {})
      for (const type in groups) {
        groups[type].sort((a, b) => a.label.localeCompare(b.label))
      }
      return { timers: this.timers, ...groups }
    }
,
    computedDeviceState() {
      return (endpoint) => {
        if (this.timerStates[endpoint]?.running === true) {
          return 'on'
        }
        return this.deviceStates[endpoint] ?? 'off'
      }
    },
  },
  async mounted() {

    // Load all contacts for RecipientsSelector
    const res = await fetch(`${base}api/contacts`);
    this.contacts = await res.json();


    // --- Devices First ---
    await this.loadDevices();
    Object.keys(this.groupedDevices).forEach(type => {
      this.openGroups[type] = true
    });

    // --- Dashboard Timers ---
    await this.loadDashboardTimers();
    await this.loadDashboardTimerHistory();

    // Poll dashboard timers every second
    this.dashboardTimerPoll = setInterval(() => {
      this.timers.forEach(timer => {
        if (timer.running) this.fetchDashboardTimerStatus(timer);
      });
    }, 1000);

    // Poll Tasmota device timers every second
    this.tasmotaTimerPoll = setInterval(() => {
      this.devices.forEach(device => {
        if (device.type === 'tasmota') {
          this.fetchTasmotaTimerStatus(device);
        }
      });
    }, 1000);

    // --- Theme ---
    const saved = localStorage.getItem('theme')
    if (saved) this.theme = saved
    document.body.classList.toggle('dark-mode', this.theme === 'dark')
    document.getElementById('app')?.classList.add(this.theme)

    // --- WebSocket for device/timer updates ---
    this.socket = io(window.location.origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling']
    })

    this.socket.on('contact-registered', async (newContact) => {
      // Re-fetch contacts (safer, avoids dupes and sync issues)
      const res = await fetch(`${base}api/contacts`);
      this.contacts = await res.json();
      // Optionall show a toast/snackbar: `${newContact.name} registered!`
    });


    this.socket.on('connect', () => console.log('[WS] Connected'))
    this.socket.on('device-status', ({ endpoint, state }) => {
      this.deviceStates[endpoint] = state
    })
    this.socket.on('timer-update', ({ device, endTime, running }) => {
      if (!this.timerStates) this.timerStates = {};
      const endpoint = device;
      if (!endpoint) return;
      this.timerStates[endpoint] = { running: !!running, endTime: endTime || null };
      if (running) {
        this.deviceStates[endpoint] = 'on';
      }
    })
    this.socket.on('dashboard-timer-created', timer => {
      // Only add if it doesn't already exist (avoid duplicates)
      if (!this.timers.some(t => t.id === timer.id)) {
        timer.display = this.formatDisplay(timer.remaining); // <- Add this line
        this.timers.push(timer);
      }
    });

    // --- Dashboard Timer Real-time Listeners ---
    this.socket.on('dashboard-timer-updated', async (updated) => {
      const timerIndex = this.timers.findIndex(timer => timer.id === updated.id);
      if (timerIndex !== -1) {
        this.timers[timerIndex] = { 
          ...this.timers[timerIndex], 
          ...updated,
          display: this.formatDisplay(updated.remaining),
          inputMinutes: null
        };
        if (typeof updated.minutes !== 'undefined') {
          this.timers[timerIndex].inputMinutes = updated.minutes;
        }
      }
      if (updated.action === 'lapsed' && this.showTimerHistory) {
        await this.loadDashboardTimerHistory();
      }
    });


    this.socket.on('dashboard-timer-removed', async ({ id }) => {
      this.removeActiveDashboardTimerById(id)
        if (this.showTimerHistory) await this.loadDashboardTimerHistory();
      // this.timers = this.timers.filter(t => t.id !== id);
    });


    // --- Initial fetch for device states and timer states ---
    await Promise.all(
      this.devices.map(async device => {
        await this.fetchStatus(device)
        if (device.type === 'tasmota') {
          await this.fetchTasmotaTimerStatus(device)
        }
      })
    )

    this.loadingDevices = false
  },

  // And in your `beforeUnmount` (or `beforeDestroy` for Vue 2)
  beforeUnmount() {
    if (this.dashboardTimerPoll) clearInterval(this.dashboardTimerPoll);
    if (this.tasmotaTimerPoll) clearInterval(this.tasmotaTimerPoll);
  },

  beforeUnmount() {
    if (this.dashboardTimerPoll) clearInterval(this.dashboardTimerPoll);
  },
  methods: {
    async updateTimerRecipients(timer, recipients) {
      console.log("updateTimerRecipients called. Recipients:", recipients);

      if (!Array.isArray(recipients)) {
        throw new Error("Recipients payload is not an array!");
      }
      await fetch(`${base}api/timers/${timer.id}/recipients`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients })
      });
      timer.recipients = recipients;
    },
    async fetchTasmotaTimerStatus(device) {
      const url = device.example === true
        ? `/api/example/${device.endpoint}/timer/status`
        : `/api/${device.endpoint}/timer/status`;

      try {
        const res = await fetch(url);
        const statusJson = await res.json();
        // Accept remainingMs or remaining
        const remaining = statusJson.remainingMs
          ? Math.floor(statusJson.remainingMs / 1000)
          : (typeof statusJson.remaining === 'number' ? statusJson.remaining : 0);
        const display = this.formatDisplay(remaining);

        this.timerStates[device.endpoint] = {
          running: !!statusJson.running,
          remaining,
          display,
          endTime: statusJson.endTime || null,
          power: statusJson.power || null
        };
        this.timerDisplays[device.endpoint] = display; // <- Ensure your card gets the updated display!
      } catch (e) {
        this.timerStates[device.endpoint] = {
          running: false,
          remaining: 0,
          display: '0:00'
        };
        this.timerDisplays[device.endpoint] = '0:00';
      }
    },
    // ----------- DASHBOARD TIMER (NEW) LOGIC -----------

    formatDate(date) {
      if (!date) return '';
      return new Date(date).toLocaleString();
    },
    async showHistory() {
      await this.loadDashboardTimerHistory();
      this.showTimerHistory = !this.showTimerHistory;
    },
    async loadDashboardTimers() {
      const res = await fetch(`${base}api/timers`);
      const timers = await res.json();
      // Ensure each timer has recipients
      this.timers = timers.map(timer => ({
        ...timer,
        recipients: Array.isArray(timer.recipients) ? timer.recipients : []
      }));
    },
    async loadDashboardTimerHistory() {
      const res = await fetch(`${base}api/timers/history`);
      this.timerHistory = await res.json();
    },
    async addDashboardTimer({ name, minutes, recipients = [] }) {
      // POST /api/timers
      const res = await fetch(`${base}api/timers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, minutes, recipients })
      });
      const timer = await res.json();
      // Defensive: ensure recipients is always an array
      if (!Array.isArray(timer.recipients)) timer.recipients = [];
      // Defensive: set timer.display for UI
      timer.display = this.formatDisplay(timer.remaining);

      // Do not push timer; rely on socket.io for real-time update
      this.showTimerForm = false;
    },

    async startDashboardTimer(timer, minutes) {
      // POST /api/timers/:id/start
      await fetch(`${base}api/timers/${timer.id}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes })
      });
      // do we need for optimistic?
      // timer.remaining = minutes * 60;
      // timer.display = this.formatDisplay(timer.remaining);
      // timer.inputMinutes = null; // Clear input field
    },
    async addToDashboardTimer(timer, minutes) {
      await this.startDashboardTimer(timer, minutes);
    },
    async cancelDashboardTimer(timer) {
      // POST /api/timers/:id/cancel
      await fetch(`${base}api/timers/${timer.id}/cancel`, { method: 'POST' });
      await this.loadDashboardTimerHistory();
    },
    async fetchDashboardTimerStatus(timer) {
      const res = await fetch(`${base}api/timers/${timer.id}/status`);
      const statusJson = await res.json();

      Object.assign(timer, statusJson);
      timer.display = this.formatDisplay(timer.remaining);

      if (!timer.running && timer.remaining === 0) {
        this.removeActiveDashboardTimerById(timer.id);
        await this.loadDashboardTimerHistory?.();
      }
    },
    // Do we ever need this? In case of network blip?
    // async updateDashboardTimer(timerId) {
    //   const res = await fetch(`${base}api/timers/${timerId}/status`);
    //   const updatedTimer = await res.json();
    //   const timerIndex = this.timers.findIndex(timer => timer.id === timerId);
    //   if (timerIndex !== -1) {
    //     this.timers[timerIndex] = { ...this.timers[timerIndex], ...updatedTimer };
    //     this.timers[timerIndex].display = this.formatDisplay(this.timers[timerIndex].remaining);
    //   }
    // },

    removeActiveDashboardTimerById(timerId) {
      this.timers = this.timers.filter(timer => timer.id !== timerId);
    },

    // ----------- TASMOTA/DEVICE LOGIC (Original) -----------
    async startDeviceTimer(device, minutes) {
      const url = this.getApiRoute(device, 'timer')
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes })
      })
      await this.fetchDeviceTimerStatus(device)
    },
    async addToDeviceTimer(device, minutes) {
      await this.startDeviceTimer(device, minutes)
      await this.fetchDeviceTimerStatus(device)
    },
    async cancelDeviceTimer(device) {
      // Cancel = POST with minutes: 0
      const url = this.getApiRoute(device, 'timer')
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes: 0 })
      })
      await this.fetchDeviceTimerStatus(device)
    },
    async fetchDeviceTimerStatus(device) {
      let url
      if (device.example === true) {
        url = `/api/example/${device.endpoint}/timer/status`
      } else {
        url = `/api/${device.endpoint}/timer/status`
      }
      try {
        const res = await fetch(url)
        const statusJson = await res.json()
        this.timerStates[device.endpoint] = {
          running: !!statusJson.running,
          endTime: statusJson.endTime || (statusJson.running ? Date.now() + (statusJson.remainingMs || 0) : null),
          power: statusJson.power || null,
        }
        if (statusJson.running) {
          this.deviceStates[device.endpoint] = 'on'
        }
      } catch {
        // fallback (do not mutate timerStates)
      }
    },

    // ------------- SHARED / UI -------------
    async loadDevices() {
      const res = await fetch(`${base}api/devices`, { cache: 'no-store' })
      const map = await res.json()
      if (map._meta?.example) {
        this.isExampleFile = true;
        this.exampleInfo = map._meta.info;
      }
      this.devices = Object.entries(map)
        .filter(([key, device]) => !key.startsWith('_') && device.verified)
        .map(([key, device]) => ({
          ...device,
          endpoint: key.toLowerCase().replace(/\s+/g, ''),
          label: device.label || key
        }))
    },
    formatDisplay(sec) {
      const min = Math.floor(sec / 60);
      const s = sec % 60;
      return `${min}:${s.toString().padStart(2, '0')}`;
    },
    toggleTheme() {
      this.theme = this.theme === 'light' ? 'dark' : 'light';
      document.body.classList.toggle('dark-mode', this.theme === 'dark');
      document.getElementById('app')?.classList.remove('light', 'dark');
      document.getElementById('app')?.classList.add(this.theme);
      localStorage.setItem('theme', this.theme);
    },
    formatType(type) {
      switch (type) {
        case 'tasmota': return 'Tasmota Devices';
        case 'govee':   return 'Govee Devices';
        default:        return type.charAt(0).toUpperCase() + type.slice(1);
      }
    },
    toggleGroup(type) {
      this.openGroups[type] = !this.openGroups[type];
    },
    scrollToGroup(type) {
      const el = this.$refs[`group-${type}`]?.[0];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    getApiRoute(device, action) {
      if (device.example === true) {
        if (device.type === 'govee') {
          return `${base}api/example/govee/${device.endpoint}/${action}`;
        }
        if (device.type === 'tasmota') {
          return `${base}api/example/${device.endpoint}/${action}`;
        }
        return `${base}api/example/${device.endpoint}/${action}`;
      }

      if (device.type === 'govee') {
        return `${base}api/govee/${device.endpoint}/${action}`;
      }
      if (device.type === 'tasmota') {
        return `${base}api/example/${device.endpoint}/${action}`;
      }
      return `${base}api/${device.endpoint}/${action}`;
    },
    async fetchStatus(device) {
      const url = this.getApiRoute(device, 'status');
      try {
        const res = await fetch(url);
        const statusJson = await res.json();
        this.deviceStates[device.endpoint] =
          statusJson?.Status?.Power === true || statusJson?.Status?.Power === 'on' ? 'on' : 'off';
      } catch {
        this.deviceStates[device.endpoint] = 'off';
      }
    },
    getCardComponent(device) {
      switch (device.type) {
        case 'tasmota': return 'TasmotaCard';
        case 'govee':   return 'GoveeCard';
        default:        return 'TasmotaCard';
      }
    },
    async fetchContacts() {
      const res = await fetch(`${base}api/contacts`);
      this.contacts = await res.json();
    },
    async onDeviceUnregistered() {
      // 1. Reload contacts (refreshes RecipientsSelector etc)
      await this.fetchContacts();

      // 2. Remove unregistered device from all timer recipient lists
      // We want to keep only recipients that still exist in the current contacts/devices list
      const validDeviceIds = new Set();
      for (const contact of this.contacts) {
        for (const device of contact.devices) {
          validDeviceIds.add(device.id);
        }
      }
      for (const timer of this.timers) {
        if (Array.isArray(timer.recipients)) {
          timer.recipients = timer.recipients.filter(
            id => validDeviceIds.has(id)
          );
        }
      }

      // 3. Optional: Clear UI selection/state related to removed device
      // Example: If you have a selectedRecipientId or selectedDeviceId, unset it if it's no longer valid
      if (this.selectedRecipientId && !validDeviceIds.has(this.selectedRecipientId)) {
        this.selectedRecipientId = null;
      }
      // Add any similar state cleanup here (alerts, dropdowns, etc.)

      // 4. Optional: Show a toast/message (if you use a toast system or fallback to alert)
      if (this.$toast) {
        this.$toast('Device successfully unregistered and removed from all recipients.');
      } else {
        // Simple fallback
        alert('Device unregistered and removed from all recipients.');
      }
    }
  }
}
</script>
