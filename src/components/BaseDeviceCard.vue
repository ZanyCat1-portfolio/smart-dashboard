<template>
  <div
    class="card base-device-card shadow-sm mx-auto"
    :data-device-type="deviceType"
  >
    <div class="card-header d-flex justify-content-between align-items-center py-2 px-3">
      <div class="d-flex align-items-center w-100" style="min-width:0;">
        <span v-if="icon" class="me-2 flex-shrink-0">
          <slot name="icon"><i :class="icon"></i></slot>
        </span>
        <span
          class="fw-bold flex-grow-1 no-wrap"
          :class="isHistorical ? 'timer-title timer-title-historical' : 'timer-title timer-title-active'"
          :title="label"
        >{{ label }}</span>


        <span
          class="badge"
          :class="{
            'bg-secondary': timerState === 'finished',
            'bg-danger': timerState === 'canceled'
          }"
          style="font-size: 0.85em;"
        >
          {{ timerState.charAt(0).toUpperCase() + timerState.slice(1) }}
        </span>

        
      </div>
      <slot name="status"></slot>
    </div>

    <div class="card-body p-3 pb-0 d-flex flex-column align-items-center">
      <slot name="actions"></slot>
      <slot />
    </div>

    <div class="card-footer text-center py-2 px-3" v-if="$slots.footer">
      <slot name="footer"></slot>
    </div>
  </div>
</template>

<script>
export default {
  name: "BaseDeviceCard",
  props: {
    label: { type: String, required: true },
    verified: { type: Boolean, default: false },
    deviceType: { type: String, default: "" },
    icon: { type: String, default: "" },
    isHistorical: { type: Boolean, default: false },
    timerState: { type: String, default: '' }
  }
}
</script>

<style scoped>
.base-device-card {
  width: 100%;
  max-width: 420px;
  min-width: 0;
  box-sizing: border-box;
  margin: 0 auto 0 auto;
  border-radius: 1rem;
  /* Responsive shadow, border */
}

/* Responsive adjustments for small screens */
@media (max-width: 600px) {
  .base-device-card {
    max-width: 98vw;
    border-radius: 0.5rem;
    padding: 0.25rem;
  }
  .card-header,
  .card-footer,
  .card-body {
    padding-left: 0.5rem !important;
    padding-right: 0.5rem !important;
  }
  .card-title {
    font-size: 1em;
  }
}

.card-title {
  font-size: 1.1rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
  min-width: 0;
  max-width: 100%;
  margin: auto;
}

@media (min-width: 601px) {
  .card-title {
    font-size: 1.15rem;
    max-width: 320px;
  }
}
</style>
