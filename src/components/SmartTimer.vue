<template>
  <div class="d-flex align-items-center mb-3 gap-2 flex-wrap timer-controls">
    <button
      class="btn btn-primary"
      @click="onStartOrPause"
    >
      {{ timer.state === 'running' ? 'Pause Timer' : 'Start Timer' }}
    </button>
    <input
      type="number"
      min="1"
      max="1440"
      v-model.number="inputMinutes"
      class="form-control"
      style="width:80px"
      placeholder="Min"
      @keydown.enter.prevent="onStartOrPause"
    />
    <button
      class="btn btn-danger"
      @click="$emit('cancel')"
    >
      Cancel Timer
    </button>
    <span style="min-width:80px;" class="ms-2 fw-bold text-info">
      <span>⏳ {{ formattedDisplay }}</span>
    </span>
  </div>
</template>

<script>
import { formatDisplay } from '../utils/utils.js';

export default {
  props: {
    timer: { type: Object, required: true }
  },
  data() {
    return {
      inputMinutes: '',
      now: Date.now(),
      intervalId: null
    }
  },
  computed: {
    formattedDisplay() {
      if (this.timer.state === 'running' && (this.timer.end_time || this.timer.endTime)) {
        // Countdown from end_time
        const end = this.timer.end_time || this.timer.endTime;
        const remaining = Math.max(0, Math.floor((new Date(end) - this.now) / 1000));
        const min = Math.floor(remaining / 60);
        const sec = remaining % 60;
        return `${min}:${sec.toString().padStart(2, '0')}`;
      } else if ((this.timer.state === 'paused' || this.timer.state === 'pending') && typeof this.timer.duration === 'number') {
        // Show paused time remaining
        const min = Math.floor(this.timer.duration / 60);
        const sec = this.timer.duration % 60;
        return `${min}:${sec.toString().padStart(2, '0')}`;
      } else if (typeof this.timer.initialDuration === 'number') {
        // Show initial value for pending/not started
        const min = Math.floor(this.timer.initialDuration / 60);
        const sec = this.timer.initialDuration % 60;
        return `${min}:${sec.toString().padStart(2, '0')}`;
      } else {
        return '00:00';
      }
    }
  },
  watch: {
    timer: {
      handler() {
        this.inputMinutes = '';
      },
      immediate: true,
      deep: true,
    }
  },
  mounted() {
    this.intervalId = setInterval(() => { this.now = Date.now(); }, 1000);
  },
  beforeUnmount() {
    clearInterval(this.intervalId);
  },
  methods: {
    onStartOrPause() {
      if (this.timer.state === 'running') {
        // Pause the timer
        this.$emit('pause');
      } else if (this.timer.state === 'paused') {
        this.$emit('unpause');
      } else {
        // Start the timer with input or default duration
        let durationSeconds;
        if (this.inputMinutes && this.inputMinutes >= 1) {
          durationSeconds = this.inputMinutes * 60;
        } else {
          durationSeconds = typeof this.timer.initialDuration === 'number'
            ? this.timer.initialDuration
            : (typeof this.timer.duration === 'number' ? this.timer.duration : 0);
        }
        this.$emit('start', durationSeconds);
      }
      this.inputMinutes = '';
    }
  }
}
</script>
