<template>
  <div class="d-flex align-items-center mb-3 gap-2 flex-wrap timer-controls">
    <h4>is timer live: {{ isTimerLive }}</h4>
    <!-- <h4>timer: {{ timer }}</h4> -->
    <button
      class="btn btn-primary"
      :disabled="!timer.minutes || timer.minutes < 1"
      @click="onStartOrAdd"
    >
      {{ isTimerLive && timer.status === 'pending' || timer.status === 'paused' ? 'Start Timer' : 'Pause Timer' }}
    </button>
    <input
      type="number"
      min="1"
      max="1440"
      v-model.number="timer.minutes"
      class="form-control"
      style="width:80px"
      placeholder="Min"
      @keydown.enter.prevent="onStartOrAdd"
    />
    <button
      class="btn btn-danger"
      @click="$emit('cancel')"
    >
      Cancel Timer
    </button>
    <span style="min-width:80px;" class="ms-2 fw-bold text-info">
      <span v-if="isTimerLive">⏳ {{ formattedRemaining }}</span>
      <span v-else style="opacity:0;">88:88</span>
    </span>
  </div>
</template>

<script>
import { formatDisplay, isLive } from '../utils/utils.js';
export default {
  props: {
    timer: { type: Object, required: true },
    // remaining: Number,
    // display: String,
    // initialMinutes: { type: Number, default: null }
  },
  computed: {
    formattedRemaining() {
      if (!this.timer.end_time) return '00:00';
      const now = Date.now();
      const end = new Date(this.timer.end_time).getTime();
      const remaining = Math.max(0, Math.round((end - now) / 1000));
      const min = Math.floor(remaining / 60);
      const sec = remaining % 60;
      return `${min}:${sec.toString().padStart(2, '0')}`;
    },
    isTimerLive() {
      return isLive(this.timer);
    }
  },
  data() {
    return {
      inputMinutes: this.initialMinutes
    }
  },
  watch: {
    // When the timer is created or updated while not running, sync the input to initialMinutes
    initialMinutes(newVal) {
      if (!this.running) {
        this.inputMinutes = newVal
      }
    },
    // When the running state changes, clear input on start, set to initialMinutes on stop/lapse/cancel
    running(newVal) {
      if (newVal) {
        this.inputMinutes = ''      // blank on start/add
      } else {
        this.inputMinutes = this.initialMinutes // repopulate after stop/cancel
      }
    }
  },
  mounted() {
    // Set input to initialMinutes only on mount (timer just created)
    if (!this.running && this.initialMinutes != null) {
      this.inputMinutes = this.initialMinutes
    }
  },
  methods: {
    onStartOrAdd() {
      if (!this.running) {
        this.$emit('start', this.inputMinutes)
      } else {
        this.$emit('add', this.inputMinutes)
      }
      // Always clear after start/add
      this.inputMinutes = ''
    }
  }
}
</script>
