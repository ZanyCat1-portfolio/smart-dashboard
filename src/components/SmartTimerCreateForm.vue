<template>
  <form @submit.prevent="submit" class="d-flex gap-2 align-items-end">
    <div>
      <label class="form-label">Timer Label</label>
      <input v-model="label" class="form-control" required 
        :tabindex="requireAuth && !sessionState.user ? -1 : 0"
      />
    </div>
    <div>
      <label class="form-label">Duration (minutes)</label>
      <input v-model.number="minutes" class="form-control" type="number" min="1" max="1440" placeholder="Min" required 
        :tabindex="requireAuth && !sessionState.user ? -1 : 0"
      />
    </div>
    <button class="btn btn-primary" type="submit"
      :tabindex="requireAuth && !sessionState.user ? -1 : 0"
    >Create Timer</button>
    <button class="btn btn-secondary" type="button" @click="$emit('cancel')"
      :tabindex="requireAuth && !sessionState.user ? -1 : 0"
    >Cancel</button>
  </form>
</template>

<script>
import { state as sessionState } from '../composables/useSessions'
export default {
  data() {
    return { 
      label: '', 
      minutes: null,
      sessionState,
     }
  },
  props: {
    requireAuth: {
      type: Boolean,
      default: false
    }
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
