<template>
  <BaseDeviceCard
  :tabindex="!sessionState.user ? 0 : -1"
  :class="{ ghosted: !sessionState.user }"
  :label="timer.label || 'Timer'"
  :verified="true"
  :is-historical="isHistorical"
  :timer-state="timer.state"
  deviceType="timer"
  icon="bi-alarm"
  >
    {{ timer.active ? timer.state == 'pending' ? 'Created' : 'Started' : 'Finished'}}
    {{ formatTimerTimeAndDate(timer.active ? timer.createdAt : timer.endTime) }}

    <button class="btn btn-outline-secondary btn-sm" @click="$emit('duplicate', timer)">
      Duplicate Timer
    </button>
    <template #actions>
      <SmartTimer
        :require-auth="!sessionState.user"
        :timer="timer"
        :is-historical="isHistorical"
        @start="startTimer"
        @pause="pauseTimer"
        @unpause="unpauseTimer"
        @add="startTimer"
        @cancel="cancelTimer"
      />

      <!-- Timer Description Field -->
      <div
        v-if="timer.description || timer.description === ''"
        class="timer-description mb-2"
      >
        <textarea
          class="form-control"
          :value="timer.description"
          rows="3"
          readonly
          style="resize: none; overflow-y: auto;"
          tabindex="-1"
          placeholder=""
        ></textarea>
      </div>
      
    <RecipientsSelector
      v-if="!isHistorical"
      :require-auth="!sessionState.user"
      :timer-id="timer.id"
      :users="Object.values(usersApi.users)"
      :devices="Object.values(devicesApi.devices)"
      :recipients="timer.recipients || []"
      :smart-timers-api="smartTimersApi"
      @recipients-change="onRecipientsChange"
    />
    <RecipientsList
      v-else
      :recipients="timer.recipients || []"
      :users="usersApi.users"
      :devices="devicesApi.devices"
    />




    </template>
  </BaseDeviceCard>
</template>

<script>
import BaseDeviceCard from './BaseDeviceCard.vue'
import SmartTimer from './SmartTimer.vue'
import RecipientsSelector from './RecipientsSelector.vue'
import RecipientsList  from './RecipientsList.vue'
import { isLive } from '../utils/utils.js'
import { state as sessionState } from '../composables/useSessions'

export default {
  name: 'SmartTimerCard',
  components: { BaseDeviceCard, SmartTimer, RecipientsSelector, RecipientsList },
  props: {
    timer: { type: Object, required: true },
    // users: { type: Array, required: true },
    devicesApi: { type: Object, required: true },
    usersApi: { type: Object, required: true },
    smartTimersApi: { type: Object, required: true },
    isHistorical: { type: Boolean, default: false }
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
    }, 
    formatTimerTimeAndDate(timestamp) {
      const date = new Date(timestamp);
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const yyyy = date.getFullYear();
      const formattedDate = `${mm}-${dd}-${yyyy}`;


      let hours = date.getHours();
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
      const time = `${hours}:${minutes} ${ampm}`;

      return `${time} ${formattedDate}`

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