<template>
  <BaseDeviceCard
    :label="timer.label || 'Timer'"
    :verified="true"
    :is-historical="true"
    :smart-timer-state="timer.state"
    deviceType="timer"
    icon="bi-alarm"
  >
    {{ formatTimerTimeAndDate(timer.endTime || timer.end_time) }}

    <button class="btn btn-outline-secondary btn-sm ms-1" @click="$emit('duplicate', timer)">
      Duplicate Timer
    </button>

    <template #actions>
      <!-- Simplified info without controls -->
      <div class="mb-2">
        <small class="text-muted">
          Duration: {{ Math.floor(timer.initialDuration / 60) }}m {{ timer.initialDuration % 60 }}s
        </small>
      </div>

      <RecipientsList
        :recipients="timer.recipients || []"
        :users="usersApi.users"
        :devices="devicesApi.devices"
      />

      <div v-if="timer.description" class="mt-2">
        <textarea
          class="form-control form-control-sm"
          :value="timer.description"
          rows="2"
          readonly
          style="resize: none; font-size: 0.8rem;"
          tabindex="-1"
        ></textarea>
      </div>
    </template>
  </BaseDeviceCard>
</template>

<script>
import BaseDeviceCard from './BaseDeviceCard.vue'
import RecipientsList from './RecipientsList.vue'

export default {
  name: 'SmartTimerHistoryItem',
  components: { BaseDeviceCard, RecipientsList },
  props: {
    timer: { type: Object, required: true },
    smartTimersApi: { type: Object, required: true },
    usersApi: { type: Object, required: true },
    devicesApi: { type: Object, required: true }
  },
  emits: ['duplicate'],
  methods: {
    formatTimerTimeAndDate(timestamp) {
      if (!timestamp) return 'Unknown time';

      const date = new Date(timestamp);
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const yyyy = date.getFullYear();
      const formattedDate = `${mm}-${dd}-${yyyy}`;

      let hours = date.getHours();
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;

      const time = `${hours}:${minutes} ${ampm}`;
      return `Finished ${time} ${formattedDate}`;
    }
  }
}
</script>

<style scoped>
/* Consistent sizing for history modal cards */
.base-device-card[data-device-type="timer"] {
  min-height: 300px;
  margin-bottom: 1rem;
}

.base-device-card[data-device-type="timer"] .card-body {
  min-height: 140px;
  /* Remove max-height and overflow to prevent scrolling */
}

.form-control[readonly] {
  background-color: #f8f9fa;
  border: 1px solid #e9ecef;
}

.form-control[readonly]:focus {
  box-shadow: none;
  border-color: #e9ecef;
  background-color: #f8f9fa;
}
</style>
