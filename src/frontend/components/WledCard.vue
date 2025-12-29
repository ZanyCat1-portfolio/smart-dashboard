<template>
  <!-- baseDeviceCard needs the height and width/responsiveness -->
  <BaseDeviceCard
    :class="resolvedIp ? '' : 'ghosted-card'" 
    :label="device.label"
    deviceType="wled-controller"
    icon="bi-lightbulb"
  >
    <template #actions>
      <!-- Switch and ON/OFF label -->
      <div class="d-flex align-items-center mb-3 gap-2">
        <AnimatedSwitch
          :model-value="localSwitchOn"
          :is-dark="theme === 'dark'"
          @update:modelValue="onOptimisticToggle"
        />
        <label class="form-check-label fw-bold" style="min-width: 38px;">
          {{ localSwitchOn ? 'ON' : 'OFF' }}
        </label>
        <!-- Go to WLED Web UI -->
      </div>
      <div class="d-flex align-items-center mb-3 gap-2">
        <button
          class="btn btn-outline-primary btn-sm ms-auto"
          @click="openWledWebUI"
          title="Open WLED Web UI"
        >
          <i class="bi bi-globe"></i> Web UI
        </button>
      </div>

      <!-- Timer Controls -->
      <div class="d-flex align-items-center gap-2 flex-wrap timer-controls">
        <button
          class="btn btn-primary timer-btn"
          :disabled="!timerMinutes || timerMinutes < 1 || actionLoading"
          @click="onTimerButton"
        >
          <span class="timer-btn-text">
            {{ isTimerRunning ? 'Add to Timer' : 'Start Timer' }}
          </span>
        </button>
        <input
          type="number"
          min="1"
          max="1440"
          v-model.number="timerMinutes"
          class="form-control"
          style="width: 80px;"
          placeholder="Min"
          @keydown.enter.prevent="onTimerButton"
        />
        <!-- Cancel Timer button -->
        <button
          class="btn btn-danger timer-btn"
          @click="cancelTimer"
          :style="{
            opacity: isTimerRunning ? 1 : 0,
            pointerEvents: isTimerRunning ? 'auto' : 'none',
            visibility: 'visible',
            transition: 'opacity 0.3s'
          }"
          tabindex="-1"
        >
          <span class="timer-btn-text">Cancel Timer</span>
        </button>
        <!-- Countdown -->
        <span
          class="ms-2 fw-bold text-info timer-countdown"
          style="min-width: 80px; transition: opacity 0.3s;"
          :style="{ opacity: isTimerRunning ? 1 : 0 }"
        >
          <span v-if="isTimerRunning">⏳ {{ timerDisplay }}</span>
          <span v-else style="opacity:0;">88:88</span>
        </span>
      </div>
      <!-- Timer message -->
      <div class="timer-message">
        <span :class="{'fade-out': !timerMessageVisible}">
          {{ timerMessageVisible && timerMessage ? timerMessage : '\u00A0' }}
        </span>
      </div>
    </template>
  </BaseDeviceCard>
</template>

<script>
import BaseDeviceCard from './BaseDeviceCard.vue'
import AnimatedSwitch from './AnimatedSwitch.vue'

export default {
  name: 'WledCard',
  components: { BaseDeviceCard, AnimatedSwitch },
  props: {
    device: { type: Object, required: true },
    state: { type: String, required: true },
    theme: { type: String, required: true },
    getApiRoute: { type: Function, required: true },
    timerState: { type: Object, default: null },
    timerDisplay: { type: String, default: '' },
    onStartTimer: { type: Function, required: true },
    onAddToTimer: { type: Function, required: true },
    onCancelTimer: { type: Function, required: true }
  },
  data() {
    return {
      localSwitchOn: this.state === 'on',
      timerMinutes: null,
      timerMessage: '',
      timerMessageVisible: false,
      messageTimeoutId: null,
      actionLoading: false,
      resolvedIp: null
    }
  },
  computed: {
    isTimerRunning() {
      return this.timerState && this.timerState.running
    }
  },
  watch: {
    state(newVal) {
      this.localSwitchOn = newVal === 'on'
    }
  },
  mounted() {
    this.resolveDeviceIp()
  },
  methods: {
    async onOptimisticToggle(newSwitchState) {
      this.localSwitchOn = newSwitchState
      const action = newSwitchState ? 'on' : 'off'
      const url = this.getApiRoute(this.device, action)
      try {
        await fetch(url, { method: 'POST' })
        // Update device state cache
        this.$emit('refresh')
      } catch (error) {
        console.error('[WLED] Toggle failed:', error)
        // Revert on error
        this.localSwitchOn = !newSwitchState
      }
    },
    async resolveDeviceIp() {
      if (this.device.example) {
        // For example devices, no IP needed
        this.resolvedIp = 'example.local'
        return
      }

      try {
        // This would ideally be handled by the backend, but for now show link when state is fetched
        await this.fetchStatus()
      } catch (error) {
        console.warn('[WLED] Could not resolve IP for', this.device.mdnsName)
      }
    },
    async togglePower() {
      const newState = !this.localSwitchOn
      this.actionLoading = true

      try {
        const action = newState ? 'on' : 'off'
        const url = this.getApiRoute(this.device, action)
        await fetch(url, { method: 'POST' })
        this.localSwitchOn = newState

        if (this.timerMessageVisible) {
          this.showMessage('')
        }
      } catch (error) {
        console.error('[WLED] Toggle failed:', error)
        // Revert on error
        this.localSwitchOn = !newState
      } finally {
        this.actionLoading = false
      }
    },
    onTimerButton() {
      if (this.isTimerRunning) {
        this.onAddToTimer(this.timerMinutes)
        this.showMessage(`Added: ${this.timerMinutes} minute${this.timerMinutes > 1 ? 's' : ''}`)
      } else {
        this.onStartTimer(this.timerMinutes)
        this.showMessage(`Start: ${this.timerMinutes} minute${this.timerMinutes > 1 ? 's' : ''}`)
      }
      this.timerMinutes = null
    },
    cancelTimer() {
      this.onCancelTimer()
      this.showMessage('Timer cancelled')
    },
    async fetchStatus() {
      const url = this.getApiRoute(this.device, 'status')
      try {
        const res = await fetch(url)
        const jsn = await res.json()
        const isOn = jsn.on === true || jsn.on === 't' // WLED returns boolean or 't' for toggle
        this.localSwitchOn = isOn
        // Store resolved IP if available
        if (jsn.resolved_ip) {
          this.resolvedIp = jsn.resolved_ip
        }
      } catch {
        // Keep current state on error
      }
    },
    openWledWebUI() {
      if (this.resolvedIp) {
        window.open(`http://${this.resolvedIp}`, '_blank')
      }
    },
    showMessage(msg) {
      this.timerMessage = msg
      this.timerMessageVisible = true
      if (this.messageTimeoutId) clearTimeout(this.messageTimeoutId)
      this.messageTimeoutId = setTimeout(() => {
        this.timerMessageVisible = false
        setTimeout(() => {
          this.timerMessage = ''
        }, 300)
      }, 3000)
    }
  }
}
</script>
<style scoped>
  .ghosted-card {
    position: relative;
    pointer-events: none;
    background-color: rgba(128, 128, 128, 0.5);
    z-index: 10;
    
  }
  .ghosted-card::after {
    content: "DISCONNECTED";
    position: absolute;
    top: 50%;
    left: 50%;
    color: red;
    font-size: 2.5em;
    font-family: 'Impact';
    -webkit-text-stroke-width: 2px;
    -webkit-text-stroke-color: red; /* Outline color */
    -webkit-text-fill-color: white;
    text-shadow: 2px 2px 4px #000000;
    z-index: 10;
    transform: translate(-50%, -50%) rotate(-22.5deg);
    
  }
</style>
