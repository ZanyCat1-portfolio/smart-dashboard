<template>
  <div class="d-flex align-items-center mb-3 gap-2 flex-wrap timer-controls">
    <h4>is timer live: {{ isTimerLive }}</h4>
    <!-- <h4>timer: {{ timer }}</h4> -->
    <button
      class="btn btn-primary"
      :disabled="!inputMinutes || inputMinutes < 1"
      @click="onStartOrAdd"
    >
      {{ isTimerLive && timer.status === 'pending' || timer.status === 'paused' ? 'Start Timer' : 'Pause Timer' }}
    </button>
    <input
      type="number"
      min="1"
      max="1440"
      v-model.number="inputMinutes"
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
    },
    // For UI, always show minutes
    timerMinutes() {
      if (typeof this.timer.duration === 'number') {
        return Math.round(this.timer.duration / 60);
      }
      return '';
    }
  },
  data() {
    return {
      inputMinutes: null
    }
  },
  watch: {
    // Sync input when timer changes (if not running)
    timer: {
      handler(newVal) {
        if (!this.isTimerLive && typeof newVal.duration === 'number') {
          this.inputMinutes = Math.round(newVal.duration / 60);
        }
      },
      immediate: true,
      deep: true
    }
  },
  mounted() {
    // On mount, set input to timer's minutes if available
    if (typeof this.timer.duration === 'number') {
      this.inputMinutes = Math.round(this.timer.duration / 60);
    }
  },
  methods: {
    onStartOrAdd() {
      if (!this.inputMinutes || this.inputMinutes < 1) return;
      const durationSeconds = this.inputMinutes * 60;
      if (!this.isTimerLive) {
        this.$emit('start', durationSeconds)
      } else {
        this.$emit('add', durationSeconds)
      }
      this.inputMinutes = '';
    }
  }
}
</script>
