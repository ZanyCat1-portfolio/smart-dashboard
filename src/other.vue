<template>
  <div :class="['card shadow-sm', theme === 'dark' ? 'tasmota-dark-card' : '']">
    <div class="card-body">
      <h5 class="card-title">{{ device.label }}</h5>
      <div class="d-flex align-items-center mb-3 gap-2">
        <AnimatedSwitch
          :model-value="state === 'on'"
          :is-dark="theme === 'dark'"
          @update:modelValue="onToggle"
        />
        <label class="form-check-label fw-bold" style="min-width: 38px;">
          {{ state.toUpperCase() }}
        </label>
      </div>
    </div>
  </div>
</template>

<script>
import AnimatedSwitch from './AnimatedSwitch.vue'
export default {
  name: 'TasmotaCard',
  components: { AnimatedSwitch },
  props: {
    device: { type: Object, required: true },
    state:  { type: String, required: true },
    theme:  { type: String, required: true }
  },
  methods: {
    async onToggle() {
      const action = this.state === 'on' ? 'off' : 'on'
      await fetch(`/api/${this.device.endpoint}/${action}`, { method: 'POST' })
      // Socket.IO will update state via prop from parent
    }
  }
}
</script>

<style scoped>
.card {
  transition: background-color 300ms, color 300ms, border-color 300ms;
}
.tasmota-dark-card {
  background-color: #1e2228;
  color: #e0e0e0;
  border-color: #333;
}
.tasmota-dark-card .card-title {
  color: #ffe082;
}
</style>
