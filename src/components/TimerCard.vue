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
      <RecipientsSelector
        :contacts="contacts"
        :recipients="timer.recipients || []"
        @recipients-change="onRecipientsChange"
      />
    </template>
  </BaseDeviceCard>
</template>

<script>
import BaseDeviceCard from './BaseDeviceCard.vue'
import Timer from './Timer.vue'
import RecipientsSelector from './RecipientsSelector.vue'

export default {
  name: 'TimerCard',
  components: { BaseDeviceCard, Timer, RecipientsSelector },
  props: {
    timer: { type: Object, required: true },
    contacts: { type: Array, required: true }
  },
  methods: {
    onRecipientsChange(newRecipients) {
      this.$emit('update-recipients', newRecipients)
    }
  }
}
</script>
