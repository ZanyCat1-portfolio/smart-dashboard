<template>
  <div
    class="card base-device-card shadow-sm mb-4 mx-auto"
    :data-device-type="deviceType"
  >
    <!-- Card Header: Icon, Name, Verified badge -->
    <div class="card-header d-flex justify-content-between align-items-center py-2 px-3">
      <div class="d-flex align-items-center w-100" style="min-width:0;">
        <span v-if="icon" class="me-2 flex-shrink-0">
          <slot name="icon"><i :class="icon"></i></slot>
        </span>
        <span
          class="fw-bold card-title flex-grow-1"
          :title="label"
        >{{ label }}</span>
      </div>
      <slot name="status"></slot>
    </div>

    <!-- Main Card Body: Actions/Controls & Default Content -->
    <div class="card-body p-3 d-flex flex-column align-items-center">
      <slot name="actions"></slot>
      <slot /> <!-- This default slot enables Timer and other child content to appear -->
    </div>

    <!-- Optional Card Footer (for timers, metadata, etc) -->
    <div class="card-footer text-center py-2 px-3" v-if="$slots.footer">
      <slot name="footer"></slot>
    </div>
  </div>
</template>


<script setup>
/**
 * BaseDeviceCard.vue
 * Responsive, mobile-first base for all device cards.
 * Uses Bootstrap classes and minimal scoped style for consistency.
 */
defineProps({
  label: { type: String, required: true },
  verified: { type: Boolean, default: false },
  deviceType: { type: String, default: "" },
  icon: { type: String, default: "" },
});
</script>

<style scoped>
.base-device-card {
  width: 100%;
  max-width: 420px;
  min-width: 0;
  box-sizing: border-box;
  margin: 0 auto 1.5rem auto;
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
