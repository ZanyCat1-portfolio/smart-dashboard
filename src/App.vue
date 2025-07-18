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

      <div class="device-registration-section mb-4">
        <div v-if="devicesApi && usersApi">
          <DeviceRegistration
            :devices-api="devicesApi"
            :users-api="usersApi"
          />
        </div>
      </div>

      <nav class="mb-4 sticky-nav">
        <ul class="nav nav-tabs">
          <li class="nav-item">
            <a class="nav-link" href="#smartTimers">
              Smart Timers
            </a>
          </li>
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
        <!-- SMART TIMERS SECTION -->
      <div id="smartTimers" class="card mb-4" style="scroll-margin-top: 4rem">
        <div>
          <div
            class="card-header d-flex justify-content-between align-items-center"
            @click="toggleGroup('smartTimers')"
            style="cursor: pointer;"
          >
            <h2 class="mb-0 text-start">Smart Timers</h2>
            <span>
              <i v-if="openGroups.smartTimers" class="bi bi-chevron-up"></i>
              <i v-else class="bi bi-chevron-down"></i>
            </span>
          </div>
          <SmartTimerCreateForm @create="handleTimerCreate" />
          <div v-show="openGroups.smartTimers" class="card-body">
            <div class="row row-cols-1 row-cols-md-2 g-4">
              <div v-for="timer in smartTimersApi.visibleSmartTimers" :key="timer.id" class="col">
                <SmartTimerCard
                  :timer="timer"
                  :users="users" 
                  :smart-timers-api="smartTimersApi"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

        <!-- DEVICE GROUPS -->
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
import SmartTimerCard from './components/SmartTimerCard.vue'
import SmartTimerCreateForm from './components/SmartTimerCreateForm.vue'
import DeviceRegistration from './components/DeviceRegistration.vue'
import { useTasmotaTimers } from './composables/useTasmotaTimers'
import { useSmartTimers } from './composables/useSmartTimers'
import { useDevices } from './composables/useDevices'
import { useUsers } from './composables/useUsers'

const base = import.meta.env.BASE_URL

export default {
  name: 'App',
  components: { TasmotaCard, GoveeCard, SmartTimerCard, SmartTimerCreateForm, DeviceRegistration },
  data() {
    return {
      currentPage: 'dashboard',
      users: [], // keep for RecipientsSelector, even if not populated yet
      contacts: [],
      loadingDevices: true,
      devices: [],
      openGroups: {},
      theme: 'light',
      isExampleFile: false,
      exampleInfo: '',
      socket: null,
      deviceStates: {},
      timerStates: {},
      smartTimerStates: {},
      timerDisplays: {},
      deviceRegistered: false,
      registeredDeviceInfo: null,
      unregistering: false,
      unregisterSuccess: false,
      unregisterError: null,
      smartTimersApi: null,
      devicesApi: null,
      usersApi: null,
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
    visibleSmartTimers() {
      return Object.values(this.smartTimerStates || {}).filter(
        t => ['pending', 'running', 'paused'].includes(t.state)
      );
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

    this.openGroups.smartTimers = true;

    const saved = localStorage.getItem('theme');
    if (saved) this.theme = saved;
    document.body.classList.toggle('dark-mode', this.theme === 'dark');
    document.getElementById('app')?.classList.add(this.theme);

    this.socket = io(window.location.origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling']
    });


    // In your setup or created/mounted block
    const tasmotaApi = useTasmotaTimers({
      socket: this.socket,
      getApiRoute: this.getApiRoute,
    });
    const smartTimersApi = useSmartTimers({
      socket: this.socket,
    });
    this.smartTimersApi = smartTimersApi;

    const devicesApi = useDevices({
      socket: this.socket,
    });
    this.devicesApi = devicesApi;

    const usersApi = useUsers({
      socket: this.socket,
    });
    this.usersApi = usersApi;

    // Attach Tasmota timers API
    this.deviceStates   = tasmotaApi.deviceStates;
    this.timerStates    = tasmotaApi.timerStates;
    this.timerDisplays  = tasmotaApi.timerDisplays;
    this.startTimer     = tasmotaApi.startTimer;
    this.addToTimer     = tasmotaApi.addToTimer;
    this.cancelTimer    = tasmotaApi.cancelTimer;
    this.fetchAndSync   = tasmotaApi.fetchAndSync;

    // Attach Smart Timers API
    this.smartTimerStates    = smartTimersApi.smartTimerStates;
    this.smartTimerDisplays  = smartTimersApi.smartTimerDisplays;
    this.getSmartTimerDisplay = smartTimersApi.getSmartTimerDisplay;
    // Add more if your new useSmartTimers composable exposes them



    await Promise.all(
      this.devices.map(async device => {
        await this.fetchStatus(device);
      })
    );

    this.loadingDevices = false;
  },

  beforeUnmount() {
    if (this.dashboardTimerPoll) clearInterval(this.dashboardTimerPoll);
    if (this.tasmotaTimerPoll) clearInterval(this.tasmotaTimerPoll);
  },

  methods: {
    async handleTimerCreate(timerData) {
      // Example: Send the timer data to your backend to create a new timer
      try {
        const response = await fetch('/api/smart-timers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(timerData),
        });
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Failed to create timer');
        }
        const newTimer = await response.json();

        // Optionally update local state, e.g., add newTimer to a list
        // this.smartTimers.push(newTimer);

        // Show a success message or reset form as needed
        console.log('Timer created successfully:', newTimer);
      } catch (error) {
        // Handle errors (show to user, log, etc.)
        console.error('Error creating timer:', error.message);
      }
    },
  async onDeviceRegistered({ userName, deviceName, isPublic }) {
    try {
      // 1. Resolve or create user
      let res = await fetch(`/api/users?username=${encodeURIComponent(userName)}`);
      let users = res.ok ? await res.json() : [];
      let user = users.length > 0 ? users[0] : null;

      if (user) {
        // Update username if needed (handle rename)
        if (user.username !== userName) {
          const updateRes = await fetch(`/api/users/${user.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: userName }),
          });
          if (!updateRes.ok) throw new Error('Failed to update username');
          user = await updateRes.json();
        }
      } else {
        res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: userName }),
        });
        user = await res.json();
        if (!user || !user.id) throw new Error('Failed to create user');
      }

      // 2. Get push subscription
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error('Push notifications not supported');
      }
      const swReg = await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Notification permission denied');

      const vapidResp = await fetch('/api/vapid-public-key');
      if (!vapidResp.ok) throw new Error('Failed to get VAPID key');
      const publicVapidKey = await vapidResp.text();

      function urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
      }

      const subscription = await swReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
      });

      // 3. Check if device exists for user and name
      res = await fetch(`/api/devices?userId=${user.id}&name=${encodeURIComponent(deviceName)}`);
      let devices = res.ok ? await res.json() : [];
      let device = devices.length > 0 ? devices[0] : null;

      if (device) {
        // Update device: mark active and update name if needed
        if (device.name !== deviceName || !device.active) {
          const patchRes = await fetch(`/api/devices/${device.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              active: true,
              name: deviceName
            }),
          });
          if (!patchRes.ok) throw new Error('Failed to update device');
          device = await patchRes.json();
        }
      } else {
        // Create new device
        res = await fetch('/api/devices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            name: deviceName,
            pushSubscription: subscription,
            isPublic,
            platform: navigator.userAgent || 'unknown',
          }),
        });
        device = await res.json();
        if (!device || !device.id) throw new Error('Failed to create device');
      }

      // 4. Update local state
      this.deviceRegistered = true;
      this.registeredDeviceInfo = {
        userId: user.id,
        deviceId: device.id,
        userName: user.username,
        deviceName: device.name,
      };
    } catch (error) {
      console.error('Device registration failed:', error);
      this.deviceRegistered = false;
    }
  },


  async onDeviceUnregistered() {
    console.log("Is this even happeNING?>?ASDF")
    try {
      if (!this.registeredDeviceInfo?.deviceId) {
        throw new Error('No registered device ID found');
      }

      const res = await fetch(`/api/devices/${this.registeredDeviceInfo.deviceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: false }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to unregister device');
      }

      this.deviceRegistered = false;
      this.registeredDeviceInfo = null;

      } catch (error) {
        console.error('Device unregistration failed:', error);
      }
    },

    async startDeviceTimer(device, minutes) {
      await this.startTimer(device, minutes)
    },
    async addToDeviceTimer(device, minutes) {
      await this.addToTimer(device, minutes)
    },
    async cancelDeviceTimer(device) {
      await this.cancelTimer(device)
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
      console.log("el is:", el)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    getApiRoute(device, action) {
      if (device.example === true) {
        if (device.type === 'govee') {
          return `${base}api/example-govee/${device.endpoint}/${action}`;
        }
        if (device.type === 'tasmota') {
          return `${base}api/example-tasmota/${device.endpoint}/${action}`;
        }
        return `${base}api/example/${device.endpoint}/${action}`;
      }
      if (device.type === 'govee') {
        return `${base}api/govee/${device.endpoint}/${action}`;
      }
      if (device.type === 'tasmota') {
        return `${base}api/tasmota/${device.endpoint}/${action}`;
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
