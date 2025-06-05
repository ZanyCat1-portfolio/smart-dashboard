<template>
  <div :class="['container mt-4', theme]">
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

    <!-- Navigation Links to Groups -->
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
                :state="computedDeviceState(device.endpoint)"
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
</template>

<script>
import { io } from 'socket.io-client'
import TasmotaCard from './components/TasmotaCard.vue'
import GoveeCard from './components/GoveeCard.vue'
import { useDeviceTimers } from './composables/useDeviceTimers'

// Declare once at the top for use everywhere
const base = import.meta.env.BASE_URL

export default {
  name: 'App',
  components: { TasmotaCard, GoveeCard },
  data() {
    return {
      loadingDevices: true,
      devices: [],
      deviceStates: {},
      openGroups: {},
      theme: 'light',
      isExampleFile: false,
      exampleInfo: '',
      socket: null,
      timerStates: {},
      timerDisplays: {},
      startTimer: null,
      addToTimer: null,
      cancelTimer: null,
    }
  },
  computed: {
    groupedDevices() {
      const groups = this.devices.reduce((acc, d) => {
        (acc[d.type] = acc[d.type] || []).push(d)
        return acc
      }, {})
      for (const type in groups) {
        groups[type].sort((a, b) => a.label.localeCompare(b.label))
      }
      return groups
    },
    computedDeviceState() {
      return (endpoint) => {
        return this.deviceStates[endpoint] ?? 'off'
      }
    },
  },
  async mounted() {
    // Theme
    const saved = localStorage.getItem('theme')
    if (saved) this.theme = saved
    document.body.classList.toggle('dark-mode', this.theme === 'dark')
    document.getElementById('app')?.classList.add(this.theme)

    // Websocket
    this.socket = io(window.location.origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling']
    })
    this.socket.on('connect', () => console.log('[WS] Connected'))

    // Device ON/OFF state updates
    this.socket.on('device-status', ({ endpoint, state }) => {
      console.log('[SOCKET RECEIVED] device-status:', endpoint, state);
      this.deviceStates[endpoint] = state
    })

    // Timer updates (from backend)
    this.socket.on('timer-update', ({ device, endTime, running }) => {
      if (!this.timerStates) this.timerStates = {};
      const endpoint = device;
      if (!endpoint) return;
      this.timerStates[endpoint] = { running: !!running, endTime: endTime || null };
      // if (running) {
      //   this.deviceStates[endpoint] = 'on';
      // }
    })

    // Init composable for timers
    const {
      timerStates,
      timerDisplays,
      startTimer,
      addToTimer,
      cancelTimer
    } = useDeviceTimers({
      socket: this.socket,
      fetchTimerStatus: this.fetchTimerStatus,
      getApiRoute: this.getApiRoute
    })
    this.timerStates = timerStates
    this.timerDisplays = timerDisplays
    this.startTimer = startTimer
    this.addToTimer = addToTimer
    this.cancelTimer = cancelTimer

    // Devices
    try {
      await this.loadDevices()
      Object.keys(this.groupedDevices).forEach(type => {
        this.openGroups[type] = true
      })

      // --- Fetch state and timer for each device ---
      await Promise.all(
        this.devices.map(async device => {
          await this.fetchStatus(device)
          await this.fetchTimerStatus(device)
        })
      )
    } catch (err) {
      console.error('Error during startup:', err)
    } finally {
      this.loadingDevices = false
    }
  },
  methods: {
    toggleTheme() {
      this.theme = this.theme === 'light' ? 'dark' : 'light'
      document.body.classList.toggle('dark-mode', this.theme === 'dark')
      document.getElementById('app')?.classList.remove('light', 'dark')
      document.getElementById('app')?.classList.add(this.theme)
      localStorage.setItem('theme', this.theme)
    },
    formatType(type) {
      switch (type) {
        case 'tasmota': return 'Tasmota Devices'
        case 'govee':   return 'Govee Devices'
        default:        return type.charAt(0).toUpperCase() + type.slice(1)
      }
    },
    toggleGroup(type) {
      this.openGroups[type] = !this.openGroups[type]
    },
    scrollToGroup(type) {
      const el = this.$refs[`group-${type}`]?.[0]
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    },
    getApiRoute(device, action) {
      if (device.example === true) {
        if (device.type === 'govee') {
          return `${base}api/example/govee/${device.endpoint}/${action}`
        }
        return `${base}api/example/${device.endpoint}/${action}`
      }
      if (device.type === 'govee') {
        return `${base}api/govee/${device.endpoint}/${action}`
      }
      return `${base}api/${device.endpoint}/${action}`
    },
    async loadDevices() {
      const res = await fetch(`${base}api/devices`, { cache: 'no-store' })
      const map = await res.json()
      if (map._meta?.example) {
        this.isExampleFile = true;
        this.exampleInfo = map._meta.info;
      }
      this.devices = Object.entries(map)
        .filter(([k, v]) => !k.startsWith('_') && v.verified)
        .map(([k, v]) => ({
          ...v,
          endpoint: k.toLowerCase().replace(/\s+/g, ''),
          label:    v.label || k
        }))
    },
    async fetchStatus(device) {
      const url = this.getApiRoute(device, 'status')
      try {
        const res = await fetch(url)
        const jsn = await res.json()
        this.deviceStates[device.endpoint] =
          jsn?.Status?.Power === true || jsn?.Status?.Power === 'on' ? 'on' : 'off'
      } catch {
        this.deviceStates[device.endpoint] = 'off'
      }
    },
    async fetchTimerStatus(device) {
      let url
      if (device.example === true) {
        url = `${base}api/example/${device.endpoint}/timer/status`
      } else {
        url = `${base}api/${device.endpoint}/timer/status`
      }
      try {
        const res = await fetch(url)
        const jsn = await res.json()
        this.timerStates[device.endpoint] = {
          running: !!jsn.running,
          endTime: jsn.endTime || (jsn.running ? Date.now() + (jsn.remainingMs || 0) : null),
          power: jsn.power || null,
        }
      } catch {
        // fallback (do not mutate timerStates)
      }
    },
    getCardComponent(device) {
      switch (device.type) {
        case 'tasmota': return 'TasmotaCard'
        case 'govee':   return 'GoveeCard'
        default:        return 'TasmotaCard'
      }
    },
  }
}
</script>

<style>

body,
#app {
  transition: background-color 300ms, color 300ms;
  background-color: #fff;
  color: #222;
}
body.dark-mode,
#app.dark {
  background-color: #121212;
  color: #e0e0e0;
}

html { scroll-behavior: smooth; }

input.form-control {
  transition: background-color 300ms, color 300ms, border-color 300ms;
}

.sticky-nav {
  position: sticky;
  top: 0;
  background: var(--bs-body-bg);
  z-index: 100;
  padding-top: 1rem;
  padding-bottom: 1rem;
}

.card {
  transition: background-color 300ms, color 300ms, border-color 300ms;
}
@media (max-width: 419px) {
  .card {
    padding: 0em;
  }
  .timer-btn-text {
    padding: 0 2px;
  }
}
@media (min-width: 420px) and (max-width: 479px) {
  .card {
    padding: 0.5em;
  }
  .timer-btn-text {
    padding: 0 3px;
  }
}
@media (min-width: 480px) and (max-width: 540px) {
  .card {
    padding: 1em;
  }
  .timer-btn-text {
    padding: 0 4px;
  }
}
@media (min-width: 541px) {
  .timer-btn-text {
    padding: 0 6px;
  }
}

.dark-mode {
  --bs-body-bg: #121212;
  --bs-body-color: #e0e0e0;
  background-color: var(--bs-body-bg);
  color: var(--bs-body-color);
  transition: background-color 300ms, color 300ms;
}
.dark-mode .card {
  background-color: #1e1e1e;
  border-color: #333;
  /* transition: background-color 300ms, border-color 300ms; */
}
.dark-mode .nav-tabs .nav-link {
  color: #ccc;
  transition: color 300ms, background-color 300ms;
}
.dark-mode .nav-tabs .nav-link.active {
  background-color: #333;
}

body, html, nav.sticky-nav, .card, .card-header, .btn, .nav-tabs .nav-link, .form-switch .form-check-input, .form-check-input::before {
  transition: background-color 300ms, color 300ms, border-color 300ms, transform 300ms;
}

/* Dark mode switch overrides */

.dark-mode .card-header {
  background-color: #444;
  transition: background-color 300ms;
}

.dark-mode .card-title {
  color: #ffe082;
  transition: color 300ms;
}

.dark-mode .form-switch .form-check-input {
  background-color: #444;
  border-color: #555;
  
}

.dark-mode .form-switch .form-check-input::before {
  background-color: #fff;  
}

.dark-mode .form-switch .form-check-input:checked {
  background-color: #666;  
}

.dark-mode .form-switch .form-check-input:focus {
  box-shadow: 0 0 0 .25rem rgba(255,255,255,0.25); 
}

.dark-mode input.form-control {
  background-color: #e0e0e0;
  color: #0e0e0e;
  border-color: #444;
}

</style>
