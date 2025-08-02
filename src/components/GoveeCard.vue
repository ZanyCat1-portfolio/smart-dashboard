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
import BaseDeviceCard from './BaseDeviceCard.vue';
import { ref } from 'vue';

const props = defineProps({
  device: { type: Object, required: true },
  getApiRoute: { type: Function, required: true }
});

const actionLoading = ref(false);
const actionMessage = ref('');

async function sendOn() {
  actionLoading.value = true;
  actionMessage.value = '';
  try {
    const url = props.getApiRoute(props.device, 'on');
    // getApiRoute located in App.vue, already parses Tasmota and Govee with proper base
    await fetch(url, { method: 'POST' });
    actionMessage.value = 'Sent ON';
  } catch (error) {
    actionMessage.value = 'Error sending ON';
  }
  actionLoading.value = false;
}

async function sendOff() {
  actionLoading.value = true;
  actionMessage.value = '';
  try {
    const url = props.getApiRoute(props.device, 'off');
    // getApiRoute located in App.vue, already parses Tasmota and Govee with proper base
    await fetch(url, { method: 'POST' });
    actionMessage.value = 'Sent OFF';
  } catch (error) {
    actionMessage.value = 'Error sending OFF';
  }
  actionLoading.value = false;
}
</script>
