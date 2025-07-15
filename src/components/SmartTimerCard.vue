<template>
  <BaseDeviceCard
    :label="timer.label || 'Timer'"
    :verified="true"
    deviceType="timer"
    icon="bi-alarm"
  >
    <template #actions>
      <SmartTimer
        :timer="timer"
        @start="startTimer"
        @add="startTimer"
        @cancel="cancelTimer"
      />
      <RecipientsSelector
        :timer-id="timer.id"
        :users="users"
        :recipients="timer.recipients || []"
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

export default {
  name: 'SmartTimerCard',
  components: { BaseDeviceCard, SmartTimer, RecipientsSelector },
  props: {
    timer: { type: Object, required: true },
    users: { type: Array, required: true }
  },
  data() {
    return {
      localRemaining: this.timer.remaining || 0,
      intervalId: null,
    }
  },
  methods: {
    resetInterval() {
      if (this.intervalId) clearInterval(this.intervalId);
      if (!this.isTimerLive) return;
      this.intervalId = setInterval(() => {
        if (this.localRemaining > 0) {
          this.localRemaining -= 1;
        }
      }, 1000);
    },
    onRecipientsChange(newRecipients) {
      this.$emit('update-recipients', newRecipients)
    },
    async startTimer(duration) {
      // duration is now passed from SmartTimer as seconds!
      const resp = await fetch(`/api/smart-timer/${this.timer.id}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration }) // always in seconds
      });
      const data = await resp.json();
      this.$emit('refresh');
    },
    async cancelTimer() {
      const resp = await fetch(`/api/smart-timer/${this.timer.id}/cancel`, { method: 'POST' });
      const data = await resp.json();
      this.$emit('refresh');
    }
  },
  watch: {
    'timer.remaining': {
      handler(newVal) {
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
