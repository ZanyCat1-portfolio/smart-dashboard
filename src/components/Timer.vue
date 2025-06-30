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
    initialMinutes: { type: Number, defualt: null }
  },
  data() {
    return {
      inputMinutes: this.initialMinutes,
    }
  },
  watch: {
    // Update input field if parent sends a new value (e.g. on socket update)
    initialMinutes(newVal) {
      // Only update if timer is NOT running, otherwise preserve entered value
      if (!this.running) {
        this.inputMinutes = newVal
      }
    },
    running(newVal) {
      if (newVal) {
        // Timer started! Clear input
        this.inputMinutes = null
      } else {
        // Timer stopped/lapsed/canceled, repopulate input with initial
        this.inputMinutes = this.initialMinutes
      }
    }
  },
  methods: {
    onStartOrAdd() {
      if (!this.runningOrPaused) {
        this.$emit('start', this.inputMinutes)
      } else {
        this.$emit('add', this.inputMinutes)
      }
      // Always clear after start/add
      this.inputMinutes = null
    }
  }
}
</script>


<!-- <template>
  <div>
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
    display: String
  },
  data() {
    return {
      inputMinutes: 5
    }
  },
  watch: {
    remaining(newVal) {
      if (!this.running) {
        this.inputMinutes = Math.round((newVal ?? 300) / 60)
      }
    }
  },
  methods: {
    onStartOrAdd() {
      if (!this.running) this.$emit('start', this.inputMinutes)
      else this.$emit('add', this.inputMinutes)
    }
  }
}
</script> -->
