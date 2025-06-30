<template>
  <form @submit.prevent="submit" class="d-flex gap-2 align-items-end">
    <div>
      <label class="form-label">Timer Name</label>
      <input v-model="name" class="form-control" required />
    </div>
    <div>
      <label class="form-label">Minutes</label>
      <input v-model.number="minutes" class="form-control" type="number" min="1" max="1440" placeholder="Min" required />
    </div>
    <button class="btn btn-primary" type="submit">Create Timer</button>
    <button class="btn btn-secondary" type="button" @click="$emit('cancel')">Cancel</button>
  </form>
</template>


<script>
export default {
  data() {
    return { name: '', minutes: null }
  },
  methods: {
    submit() {
      if (!this.name || !this.minutes) return
      this.$emit('create', { name: this.name, minutes: this.minutes })
      this.name = ''
      this.minutes = null
    }
  }
}
</script>
