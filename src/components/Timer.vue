<template>
  <div class="d-flex align-items-center mb-3 gap-2 flex-wrap timer-controls">
    <button
      class="btn btn-primary"
      :disabled="!inputMinutes || inputMinutes < 1"
      @click="onStartOrAdd"
    >
      {{ running ? 'Add to Timer' : 'Start Timer' }}
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
      v-show="running"
      @click="$emit('cancel')"
    >
      Cancel Timer
    </button>
    <span style="min-width:80px;" class="ms-2 fw-bold text-info">
      <span v-if="running">⏳ {{ display }}</span>
      <span v-else style="opacity:0;">88:88</span>
    </span>
  </div>
</template>

<script>
export default {
  props: {
    running: Boolean,
    remaining: Number,
    display: String,
    initialMinutes: { type: Number, default: null }
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
