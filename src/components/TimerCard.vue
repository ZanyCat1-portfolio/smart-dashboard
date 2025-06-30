<template>
  <BaseDeviceCard
    :label="timer.name || 'Timer'"
    :verified="true"
    deviceType="timer"
    icon="bi-alarm"
  >
    <template #actions>
    <Timer
      :running="timer.running"
      :remaining="timer.remaining"
      :display="timer.display"
      :initial-minutes="timer.inputMinutes"
      @start="min => $emit('start', min)"
      @add="min => $emit('add', min)"
      @cancel="$emit('cancel')"
    />
    </template>
  </BaseDeviceCard>
</template>

<script>
import BaseDeviceCard from './BaseDeviceCard.vue'
import Timer from './Timer.vue'

export default {
  name: 'TimerCard',
  components: { BaseDeviceCard, Timer },
  props: {
    timer: { type: Object, required: true }
  }
}
</script>

<!-- <template>
  <div class="card">
    <h4>{{ timer.name }}</h4>
    <Timer
      :running="timer.running"
      :remaining="timer.remaining"
      :display="timer.display"
      @start="min => $emit('start', min)"
      @add="min => $emit('add', min)"
      @cancel="$emit('cancel')"
    />
  </div>
</template>

<script>
import Timer from './Timer.vue'

export default {
  props: { timer: Object },
  components: { Timer }
}
</script> -->
