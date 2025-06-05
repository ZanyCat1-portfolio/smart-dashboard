<template>
  <div style="border: 1px solid #ccc; padding: 1rem; margin: 1rem; border-radius: 6px;">
    <h2>{{ label }}</h2>
    <button @click="toggle" :disabled="loading">
      {{ loading ? 'Toggling...' : 'Toggle' }}
    </button>
  </div>
</template>

<script>
export default {
  props: ['label', 'endpoint'],
  data() {
    return { loading: false }
  },
  methods: {
    async toggle() {
      this.loading = true;
      try {
        await fetch(`/api/${this.endpoint}/toggle`, { method: 'GET' });
      } catch (e) {
        alert('Failed to toggle switch: ' + e.message);
      } finally {
        this.loading = false;
      }
    }
  }
}
</script>
