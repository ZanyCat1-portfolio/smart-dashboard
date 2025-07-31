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
        <!-- Simple login form if not logged in -->
        <div v-if="!sessionState.user">
          <div class="mb-2">
            <button
              class="btn btn-outline-primary me-2"
              :class="{ active: !showRegister }"
              @click="showRegister = false"
            >Login</button>
            <button
              class="btn btn-outline-secondary"
              :class="{ active: showRegister }"
              @click="showRegister = true"
            >Register</button>
          </div>
          
          <LoginForm v-if="!showRegister" @login-success="onLoginSuccess" />
          <RegisterForm v-else @register-success="onRegisterSuccess" />
        </div>

        <!-- Show DeviceRegistration only when logged in -->
        <div v-else>
          <h2>Logged in as {{  sessionState.user.username }}</h2>
          <button @click="logout" class="btn btn-secondary mb-2">Log Out</button>
          <DeviceRegistration v-if="sessionState.user"
            :user="sessionState.user"
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
         <SmartTimersSection
          :smart-timers-api="smartTimersApi"
          :users-api="usersApi"
          :devices-api="devicesApi"
          :session-state="sessionState"
          @create="handleTimerCreate"
        />

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
import socket from './composables/useSocket'
import TasmotaCard from './components/TasmotaCard.vue'
import GoveeCard from './components/GoveeCard.vue'
import SmartTimerCard from './components/SmartTimerCard.vue'
import SmartTimerCreateForm from './components/SmartTimerCreateForm.vue'
import DeviceRegistration from './components/DeviceRegistration.vue'
import { useTasmotaTimers } from './composables/useTasmotaTimers'
import { useSmartTimers } from './composables/useSmartTimers'
import { useDevices } from './composables/useDevices'
import { useUsers } from './composables/useUsers'
import { refreshLoginTimer } from './utils/utils'
import LoginForm from './components/LoginForm.vue'
import RegisterForm from './components/RegisterForm.vue'
import SmartTimersSection from './components/SmartTimersSection.vue'
import { state as sessionState, useSession } from './composables/useSessions'

const TIMEOUT_DAYS = 24
const TIMEOUT_MINUTES = TIMEOUT_DAYS * 1440;
const LOGIN_TIMEOUT = TIMEOUT_MINUTES * 60 * 1000;

const base = import.meta.env.BASE_URL

export default {
  name: 'App',
  components: {
    TasmotaCard,
    GoveeCard,
    SmartTimerCard,
    SmartTimerCreateForm,
    DeviceRegistration,
    LoginForm,
    RegisterForm,
    SmartTimersSection
  },
  data() {
    return {
      currentPage: 'dashboard',
      users: [],
      contacts: [],
      loadingDevices: true,
      devices: [],
      openGroups: {},
      theme: 'light',
      isExampleFile: false,
      exampleInfo: '',
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
      username: '',
      loginError: null,
      loginTimer: null,
      userSuggestions: JSON.parse(localStorage.getItem('usernames') || '[]'),
      showRegister: false,
      sessionState
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
    console.log("App vue mounted")
    // this.logout()

    // 1. Register all composables immediately!
    const tasmotaApi = useTasmotaTimers({ socket, getApiRoute: this.getApiRoute });
    const smartTimersApi = useSmartTimers({ socket });
    this.smartTimersApi = smartTimersApi;
    const devicesApi = useDevices({ socket });
    this.devicesApi = devicesApi;
    const usersApi = useUsers({ socket });
    this.usersApi = usersApi;

    this.deviceStates = tasmotaApi.deviceStates;
    this.timerStates = tasmotaApi.timerStates;
    this.timerDisplays = tasmotaApi.timerDisplays;
    this.startTimer = tasmotaApi.startTimer;
    this.addToTimer = tasmotaApi.addToTimer;
    this.cancelTimer = tasmotaApi.cancelTimer;
    this.fetchAndSync = tasmotaApi.fetchAndSync;
    this.smartTimerStates = smartTimersApi.smartTimerStates;
    this.smartTimerDisplays = smartTimersApi.smartTimerDisplays;
    this.getSmartTimerDisplay = smartTimersApi.getSmartTimerDisplay;

    window.smartTimerStates = smartTimersApi.smartTimerStates;

    // 2. All other awaits and DOM logic after handlers
    await this.loadDevices();
    Object.keys(this.groupedDevices).forEach(type => { this.openGroups[type] = true; });
    this.openGroups.smartTimers = true;
    const saved = localStorage.getItem('theme');
    if (saved) this.theme = saved;
    document.body.classList.toggle('dark-mode', this.theme === 'dark');
    document.getElementById('app')?.classList.add(this.theme);

    await Promise.all(
      this.devices.map(async device => {
        await this.fetchStatus(device);
      })
    );

    this.loadingDevices = false;

    const storedUserString = localStorage.getItem('user');
    sessionState.user = null;
    if (storedUserString) {
      const storedUserJSON = JSON.parse(storedUserString)
      for (let user in usersApi.users) {
        if (usersApi.users[user].username === storedUserJSON.username) {
          console.log(`found ${storedUserJSON.username}!`)
          sessionState.user = storedUserJSON; // <--- set your global state!
        }
      }
    }
  },
  beforeUnmount() {
    if (this.dashboardTimerPoll) clearInterval(this.dashboardTimerPoll);
    if (this.tasmotaTimerPoll) clearInterval(this.tasmotaTimerPoll);
  },
  watch: {
    isLoggedIn(val) {
      if (val) this.startLoginTimer();
      else this.clearLoginTimer();
    }
  },
  methods: {
    onLoginSuccess(user) {
      sessionState.user = user
      localStorage.setItem('user', JSON.stringify(user));
      this.startLoginTimer();
    },
    onRegisterSuccess(user) {
      sessionState.user = user
      localStorage.setItem('user', JSON.stringify(user));
      this.startLoginTimer();
    },
    // async login() {
    //   console.log('NO THIS IS GETTING CALL')
    //   this.loginError = null;
    //   const username = this.username.trim();
    //   console.log("on login, what is username: ", !!username)
    //   if (!username) return;
    //   console.log("Do I here?")

    //   try {
    //     // 1. Validate user (create if not found)
    //     let user = await this.usersApi.getUserByUsername(username);
    //     if (!user) {
    //       user = await this.usersApi.createUser(username);
    //       if (!user) throw new Error("Failed to create user");
    //     }
    //     sessionState.user = user

    //     // 2. Save username to suggestions
    //     let suggestions = this.userSuggestions;
    //     if (!suggestions.includes(username)) {
    //       suggestions.push(username);
    //       localStorage.setItem('usernames', JSON.stringify(suggestions));
    //     }
    //     // Optionally persist logged in user
    //     localStorage.setItem('user', JSON.stringify(user));

    //     // 3. Start login timer
    //     this.startLoginTimer();

    //   } catch (e) {
    //     this.loginError = e.message || "Login failed";
    //   }
    // },
    async logout() {
      await useSession().logout();
      localStorage.setItem('user', '');
      this.clearLoginTimer();
    },
    startLoginTimer() {
      this.clearLoginTimer();
      console.log("login_timeout is: ", LOGIN_TIMEOUT)
      this.loginTimer = refreshLoginTimer(() => {
        this.logout();
      }, LOGIN_TIMEOUT);
    },
    clearLoginTimer() {
      if (this.loginTimer) clearTimeout(this.loginTimer);
      this.loginTimer = null;
    },
    async handleTimerCreate(timerData) {
      console.log("DO I HAPPEN?")
      // SHOULD THIS HAPPEN IN SMARTTIMER COMPONENT?
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

        // Show a success message or reset form as needed
        console.log('Timer created successfully:', newTimer);
      } catch (error) {
        // Handle errors (show to user, log, etc.)
        console.error('Error creating timer:', error.message);
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
