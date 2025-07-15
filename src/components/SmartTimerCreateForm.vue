<template>
  <form @submit.prevent="submit" class="d-flex gap-2 align-items-end">
    <div>
      <label class="form-label">Timer Label</label>
      <input v-model="label" class="form-control" required />
    </div>
    <div>
      <label class="form-label">Duration (minutes)</label>
      <input v-model.number="minutes" class="form-control" type="number" min="1" max="1440" placeholder="Min" required />
    </div>
    <button class="btn btn-primary" type="submit">Create Timer</button>
    <button class="btn btn-secondary" type="button" @click="$emit('cancel')">Cancel</button>
  </form>
</template>

<script>
export default {
  data() {
    return { label: '', minutes: null }
  },
  methods: {
    async submit() {
      if (!this.label || !this.minutes) return;
      const duration = this.minutes * 60; // Convert to seconds for backend
      this.$emit('create', { label: this.label, duration });
      this.label = '';
      this.minutes = null;
    }
  }
}
</script>
