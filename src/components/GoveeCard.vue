<template>
  <BaseDeviceCard
    :label="device.label"
    :verified="device.verified"
    deviceType="govee"
    icon="bi-lightbulb"
  >
    <template #actions>
      <div class="d-flex gap-2">
        <button class="btn btn-success" @click="sendOn" :disabled="actionLoading">Turn On</button>
        <button class="btn btn-danger" @click="sendOff" :disabled="actionLoading">Turn Off</button>
      </div>
      <div class="action-message mt-2">
        <span :class="{ 'fade-out': !actionMessage }">
          {{ actionMessage ? actionMessage : '\u00A0' }}
        </span>
      </div>
    </template>
  </BaseDeviceCard>
</template>

<script setup>
import { ref } from 'vue';
import BaseDeviceCard from './BaseDeviceCard.vue';

const props = defineProps({
  device: {
    type: Object,
    required: true
  }
});

const actionLoading = ref(false);
const actionMessage = ref('');

async function sendOn() {
  actionLoading.value = true;
  actionMessage.value = '';
  try {
    await fetch(`/api/govee/${props.device.device}/on`, { method: 'POST' });
    actionMessage.value = 'Sent ON';
  } catch (err) {
    actionMessage.value = 'Error sending ON';
  }
  actionLoading.value = false;
}

async function sendOff() {
  actionLoading.value = true;
  actionMessage.value = '';
  try {
    await fetch(`/api/govee/${props.device.device}/off`, { method: 'POST' });
    actionMessage.value = 'Sent OFF';
  } catch (err) {
    actionMessage.value = 'Error sending OFF';
  }
  actionLoading.value = false;
}
</script>