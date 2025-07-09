<template>
  <BaseDeviceCard
    :label="timer.name || 'Timer'"
    :verified="true"
    deviceType="timer"
    icon="bi-alarm"
  >
    <template #actions>
      <Timer
        :timer="timer"
        @start="startTimer"
        @add="startTimer"
        @cancel="cancelTimer"
      />
      <RecipientsSelector
        :timer-id="timer.id"
        :contacts="contacts"
        :recipients="timer.recipients || []"
        @recipients-change="onRecipientsChange"
      />
    </template>
  </BaseDeviceCard>
</template>

<script>
import BaseDeviceCard from './BaseDeviceCard.vue'
import Timer from './Timer.vue'
import RecipientsSelector from './RecipientsSelector.vue'
import { isLive } from '../utils/utils.js'

export default {
  name: 'TimerCard',
  components: { BaseDeviceCard, Timer, RecipientsSelector },
  props: {
    timer: { type: Object, required: true },
    contacts: { type: Array, required: true }
  },
  data() {
    return {
      localRemaining: this.timer.remaining || 0,
      intervalId: null,
    }
  },
  methods: {
    resetInterval() {
      console.log('[resetInterval] called, running:', this.isTimerLive, 'localRemaining:', this.localRemaining)
      if (this.intervalId) clearInterval(this.intervalId);
      if (!this.isTimerLive) return;
      this.intervalId = setInterval(() => {
        if (this.localRemaining > 0) {
          this.localRemaining -= 1;
          console.log('[interval] localRemaining:', this.localRemaining)
        }
      }, 1000);
    },
    onRecipientsChange(newRecipients) {
      this.$emit('update-recipients', newRecipients)
    },
    async startTimer() {
      console.log('[startTimer] sending POST with minutes:', this.timer.minutes)
      const resp = await fetch(`/api/timers/${this.timer.id}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes: this.timer.minutes })
      });
      const data = await resp.json();
      console.log('[startTimer] response:', data)
      this.$emit('refresh');
    },
    async cancelTimer() {
      console.log('[cancelTimer] sending POST')
      const resp = await fetch(`/api/timers/${this.timer.id}/cancel`, { method: 'POST' });
      const data = await resp.json();
      console.log('[cancelTimer] response:', data)
      this.$emit('refresh');
    }
  },
  watch: {
    'timer.remaining': {
      handler(newVal) {
        console.log('[watch:timer.remaining] newVal:', newVal)
        this.localRemaining = newVal;
        this.resetInterval();
      },
      immediate: true,
    },
  },
  computed: {
    isTimerLive() {
      return isLive(this.timer);
    },
    display() {
      const min = Math.floor(this.localRemaining / 60);
      const sec = this.localRemaining % 60;
      return `${min}:${sec.toString().padStart(2, '0')}`;
    }
  },
  beforeDestroy() {
    if (this.intervalId) clearInterval(this.intervalId);
  }
}
</script>
