<template>
  <BaseDeviceCard
    :tabindex="!sessionState.user ? 0 : -1"
    :class="{ ghosted: !sessionState.user }"
    :label="timer.label || 'Timer'"
    :verified="true"
    deviceType="timer"
    icon="bi-alarm"
  >
    <template #actions>
      <SmartTimer
        :require-auth="!sessionState.user"
        :timer="timer"
        @start="startTimer"
        @pause="pauseTimer"
        @unpause="unpauseTimer"
        @add="startTimer"
        @cancel="cancelTimer"
      />
      <RecipientsSelector
        :require-auth="!sessionState.user"
        :timer-id="timer.id"
        :users="Object.values(usersApi.users)"
        :devices="Object.values(devicesApi.devices)"
        :recipients="timer.recipients || []"
        :smart-timers-api="smartTimersApi"
        @recipients-change="onRecipientsChange"
      />
    </template>
  </BaseDeviceCard>
</template>

<script>
import BaseDeviceCard from './BaseDeviceCard.vue'
import SmartTimer from './SmartTimer.vue'
import RecipientsSelector from './RecipientsSelector.vue'
import { isLive } from '../utils/utils.js'
import { state as sessionState } from '../composables/useSessions'

export default {
  name: 'SmartTimerCard',
  components: { BaseDeviceCard, SmartTimer, RecipientsSelector },
  props: {
    timer: { type: Object, required: true },
    // users: { type: Array, required: true },
    devicesApi: { type: Object, required: true },
    usersApi: { type: Object, required: true },
    smartTimersApi: { type: Object, required: true }
  },
  data() {
    return {
      now: Date.now(),
      intervalId: null,
      // users: []
    }
  },
    watch: {
    'timer.state': {
      immediate: true,
      handler(newState) {
        if (newState === 'running') {
          // Start the interval
          if (!this.intervalId) {
            this.intervalId = setInterval(() => {
              this.now = Date.now();
            }, 1000);
          }
        } else {
          // Stop the interval
          if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
          }
          // (Optional: update `now` one last time on pause/finish)
          this.now = Date.now();
        }
      }
    }
  },
  mounted() {
    this.now = Date.now();
  },
  beforeUnmount() {
    if (this.intervalId) clearInterval(this.intervalId);
  },
  methods: {
    onRecipientsChange(newRecipients) {
      this.$emit('update-recipients', newRecipients)
    },
    async startTimer(duration) {
      this.smartTimersApi.startTimer(this.timer.id, duration);
    },
    async pauseTimer() {
      this.smartTimersApi.pauseTimer(this.timer.id);
    },
    async unpauseTimer() {
      this.smartTimersApi.unpauseTimer(this.timer.id)
    },
    async cancelTimer() {
      this.smartTimersApi.cancelTimer(this.timer.id)
    }
  },
  computed: {
    sessionState: () => sessionState,
    isTimerLive() {
      return isLive(this.timer);
    },
    remainingSeconds() {
      if (this.timer.state === 'running' && this.timer.end_time) {
        return Math.max(0, Math.floor((new Date(this.timer.end_time) - this.now) / 1000));
      } else if (this.timer.state === 'paused' && typeof this.timer.duration === 'number') {
        return Math.max(0, Math.floor(this.timer.duration));
      } else if (this.timer.state === 'pending' && typeof this.timer.initialDuration === 'number') {
        return Math.max(0, Math.floor(this.timer.initialDuration));
      }
      // Always return 0 as fallback, not undefined
      return 0;
    },
    display() {
      const min = Math.floor(this.remainingSeconds / 60);
      const sec = Math.abs(this.remainingSeconds % 60); // use abs for safety
      return `${min}:${sec.toString().padStart(2, '0')}`;
    }
  }
}
</script>