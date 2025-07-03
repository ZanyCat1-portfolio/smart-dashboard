<template>
  <BaseDeviceCard
    :label="device.label"
    deviceType="tasmota"
    icon="bi-plug"
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
      </div>
      <!-- Timer Controls: stable, always-present layout -->
      <div class="d-flex align-items-center gap-2 flex-wrap timer-controls">
        <button
          class="btn btn-primary timer-btn"
          :disabled="!timerMinutes || timerMinutes < 1"
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
        <!-- Cancel Timer button: always present for stable height -->
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
        <!-- Countdown: always present for stable height -->
        <span
          class="ms-2 fw-bold text-info timer-countdown"
          style="min-width: 80px; transition: opacity 0.3s;"
          :style="{ opacity: isTimerRunning ? 1 : 0 }"
        >
          <span v-if="isTimerRunning">⏳ {{ timerDisplay }}</span>
          <span v-else style="opacity:0;">88:88</span>
        </span>
      </div>
      <!-- Timer message, always present for stable height -->
      <div class="timer-message">
        <span :class="{'fade-out': !timerMessageVisible}">
          {{ timerMessageVisible && timerMessage ? timerMessage : '\u00A0' }}
        </span>
      </div>
    </template>
  </BaseDeviceCard>
</template>

<script>
import AnimatedSwitch from './AnimatedSwitch.vue'
import BaseDeviceCard from './BaseDeviceCard.vue' // REQUIRED for composition-based templates

export default {
  name: 'TasmotaCard',
  components: { AnimatedSwitch, BaseDeviceCard },
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
      
      messageTimeoutId: null
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
    // console.log('TasmotaCard props:', {
    //   timerState: this.timerState,
    //   timerDisplay: this.timerDisplay,
    //   onStartTimer: this.onStartTimer,
    //   onAddToTimer: this.onAddToTimer,
    //   onCancelTimer: this.onCancelTimer
    // });
  },
  methods: {
    async onOptimisticToggle(newSwitchState) {
      this.localSwitchOn = newSwitchState
      const action = newSwitchState ? 'on' : 'off'
      const url = this.getApiRoute(this.device, action)
      await fetch(url, { method: 'POST' })
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
    async checkTimerStatus() {
      const url = this.getApiRoute(this.device, 'timer/status');
      const response = await fetch(url);
      const statusJson = await response.json();
    },
    formatCountdown(ms) {
      const total = Math.max(0, Math.floor(ms / 1000))
      const min = Math.floor(total / 60)
      const sec = total % 60
      return `${min}:${sec.toString().padStart(2, '0')}`
    },
    showMessage(msg) {
      this.timerMessage = msg;
      this.timerMessageVisible = true;
      if (this.messageTimeoutId) clearTimeout(this.messageTimeoutId);
      this.messageTimeoutId = setTimeout(() => {
        this.timerMessageVisible = false;
        setTimeout(() => {
          this.timerMessage = '';
        }, 300); // 300ms matches CSS transition
      }, 3000);
    }
  }
}
</script>