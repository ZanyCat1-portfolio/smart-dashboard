<template>
  <div class="recipients-list recipients-list-container mt-2 text-start">
    <div class="fw-bold mb-1">Recipients:</div>
    <ul class="list-unstyled mb-0">
      <li
        v-for="r in recipients"
        :key="r.id || r.userId || r.deviceId || r"
      >
        <span v-if="userFor(r)">
          {{ userFor(r).username || userFor(r).name }}
        </span>
        <span v-else-if="r.username">
          {{ r.username }}
        </span>
        <span v-else-if="r.name">
          {{ r.name }}
        </span>
        <span v-else>
          {{ r.userId || r.deviceId || r }}
        </span>
        <span v-if="deviceFor(r)">
          &mdash; <span style="font-size:0.9em;">
            {{ deviceFor(r).name || deviceFor(r).id }}
          </span>
        </span>
      </li>
      <li v-if="!recipients || recipients.length === 0">None</li>
    </ul>
  </div>
</template>

<script>
export default {
  name: "RecipientsList",
  props: {
    recipients: { type: Array, required: true },
    users: { type: Object, required: false, default: null },
    devices: { type: Object, required: false, default: null }
  },
  methods: {
    userFor(recipient) {
      if (!this.users) return null;
      // Accept both r.userId and r.id
      return this.users[recipient.userId] || this.users[recipient.id] || null;
    },
    deviceFor(recipient) {
      if (!this.devices) return null;
      return this.devices[recipient.deviceId] || this.devices[recipient.id] || null;
    }
  }
}
</script>

<style scoped>
.recipients-list {
  font-size: 1em;
}
.recipients-list-container {
  width: 100%;
  /* Always at least 3 devices tall, scroll if more */
  max-height: 5.5em; /* Approx 3 rows tall */
  min-height: 5.5em;
  overflow-y: auto;
  background: transparent;
  padding-bottom: 2px;
}
</style>
