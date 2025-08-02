<template>
  <div style="border: 1px solid #ccc; padding: 1rem; margin: 1rem; border-radius: 6px;">
    <h2>{{ label }}</h2>
    <button @click="toggle" :disabled="loading">
      {{ loading ? 'Toggling...' : 'Toggle' }}
    </button>
  </div>
</template>

<script>
import { frontendFetch } from '../utils/utils';
export default {
  props: {
    label: { type: String, required: true },
    endpoint: { type: String, required: true }
  },
  data() {
    return { loading: false }
  },
  methods: {
    async toggle() {
      this.loading = true;
      try {
        await frontendFetch(`/api/${this.endpoint}/toggle`, { method: 'GET' });
      } catch (error) {
        alert('Failed to toggle switch: ' + error.message);
      } finally {
        this.loading = false;
      }
    }
  }
}
</script>
