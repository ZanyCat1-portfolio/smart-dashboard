<template>
  <div :class="['container mt-4', theme]">
    <div>
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h1 class="display-4 text-primary">Smart Switch Dashboard</h1>
        <button @click="toggleTheme" class="btn btn-outline-secondary">
          <i :class="theme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-fill'"></i>
          {{ theme === 'dark' ? 'Light Mode' : 'Dark Mode' }}
        </button>
      </div>

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
            <div class="row row-cols-1 row-cols-md-2 g-4">
              <div v-for="device in devices" :key="device.endpoint" class="col">
                <component
                  :is="getCardComponent(device)"
                  :device="device"
                  :state="deviceStates[device.endpoint]"
                  :theme="theme"
                  :get-api-route="getApiRoute"
                  :timer-state="timerStates[device.endpoint]"
                  :timer-display="timerDisplays[device.endpoint]"
                  :on-start-timer="(minutes) => startTimer(device, minutes)"
                  :on-add-to-timer="(minutes) => addToTimer(device, minutes)"
                  :on-cancel-timer="() => cancelTimer(device)"
                  @refresh="fetchStatus(device)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { io } from 'socket.io-client'
import TasmotaCard from './components/TasmotaCard.vue'
import GoveeCard from './components/GoveeCard.vue'
import { useDeviceTimers } from './composables/useDeviceTimers'

const base = import.meta.env.BASE_URL

export default {
  name: 'App',
  components: { TasmotaCard, GoveeCard },
  data() {
    return {
      currentPage: 'dashboard',
      contacts: [],
      loadingDevices: true,
      devices: [],
      openGroups: {},
      theme: 'light',
      isExampleFile: false,
      exampleInfo: '',
      socket: null,

      // ADD THESE (null to start)
      deviceStates: {},
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
      return { ...groups }
    },
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
    await this.loadDevices();
    Object.keys(this.groupedDevices).forEach(type => {
      this.openGroups[type] = true;
    });

    const saved = localStorage.getItem('theme');
    if (saved) this.theme = saved;
    document.body.classList.toggle('dark-mode', this.theme === 'dark');
    document.getElementById('app')?.classList.add(this.theme);

    this.socket = io(window.location.origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling']
    });

    // INIT COMPOSABLE AND ATTACH TO `this`
    const timersApi = useDeviceTimers({
      socket: this.socket,
      
      getApiRoute: this.getApiRoute,
    });
    // Attach to Vue instance for template access
    this.deviceStates  = timersApi.deviceStates;
    this.timerStates   = timersApi.timerStates;
    this.timerDisplays = timersApi.timerDisplays;
    this.startTimer    = timersApi.startTimer;
    this.addToTimer    = timersApi.addToTimer;
    this.cancelTimer   = timersApi.cancelTimer;
    this.fetchAndSync  = timersApi.fetchAndSync;

    await Promise.all(
      this.devices.map(async device => {
        await this.fetchStatus(device);
        // REMOVE: no timer fetch here; handled by composable
      })
    );

    this.loadingDevices = false;
  },

  beforeUnmount() {
    if (this.dashboardTimerPoll) clearInterval(this.dashboardTimerPoll);
    if (this.tasmotaTimerPoll) clearInterval(this.tasmotaTimerPoll);
  },

  methods: {
    
    async startDeviceTimer(device, minutes) {
      await startTimer(device, minutes)
    },
    async addToDeviceTimer(device, minutes) {
      await addToTimer(device, minutes)
    },
    async cancelDeviceTimer(device) {
      await cancelTimer(device)
    },

    async loadDevices() {
      const res = await fetch(`${base}api/tasmota/devices`, { cache: 'no-store' })
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
          return `${base}api/example-govee/example/govee/${device.endpoint}/${action}`;
        }
        if (device.type === 'tasmota') {
          return `${base}api/example-tasmota/example/${device.endpoint}/${action}`;
        }
        return `${base}api/example/${device.endpoint}/${action}`;
      }
      if (device.type === 'govee') {
        return `${base}api/govee/${device.endpoint}/${action}`;
      }
      if (device.type === 'tasmota') {
        return `${base}api/example/${device.endpoint}/${action}`;
      }
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
  }
}
</script>
