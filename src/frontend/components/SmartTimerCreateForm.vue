<template>
  <form @submit.prevent="submit" class="d-flex gap-2 align-items-end">
    <div>
      <label class="form-label">Timer Label</label>
      <input
        ref="firstInput"
        v-model="label"
        class="form-control"
        maxlength="10"
        placeholder="Label (max 10 chars)"
        required
        :tabindex="requireAuth && !sessionState.user ? -1 : 0"
      />
    </div>
    <div>
      <label class="form-label">Description (optional)</label>
      <input
        v-model="description"
        class="form-control"
        maxlength="365"
        :tabindex="requireAuth && !sessionState.user ? -1 : 0"
      />
    </div>
    <div>
      <label class="form-label">Duration (minutes)</label>
      <input
        v-model.number="minutes"
        class="form-control"
        type="number"
        min="1"
        max="1440"
        placeholder="Min"
        required
        :tabindex="requireAuth && !sessionState.user ? -1 : 0"
      />
    </div>
    <button
      class="btn btn-primary"
      type="submit"
      :tabindex="requireAuth && !sessionState.user ? -1 : 0"
    >
      Create Timer
    </button>
    <button
      class="btn btn-secondary"
      type="button"
      @click="$emit('cancel')"
      :tabindex="requireAuth && !sessionState.user ? -1 : 0"
    >
      Cancel
    </button>
  </form>
</template>

<script>
import { state as sessionState } from '../composables/useSessions'
import { nextTick } from 'vue'

export default {
  props: {
    requireAuth: {
      type: Boolean,
      default: false
    },
    initialData: {
      type: Object,
      default: null
    }
  },
  data() {
    return {
      label: '',
      minutes: null,
      description: '',
      sessionState
    }
  },
  watch: {
    initialData: {
      immediate: true,
      async handler(newVal) {
        if (newVal) {
          this.label = newVal.label || ''
          this.description = newVal.description || ''
          this.minutes = newVal.minutes != null ? newVal.minutes : null
          // Wait for DOM update, then focus first input
          await nextTick()
          this.$refs.firstInput?.focus()
        } else {
          this.label = ''
          this.description = ''
          this.minutes = null
        }
      }
    }
  },
  methods: {
    async submit() {
      if (!this.label || !this.minutes) return
      const duration = this.minutes * 60 // Convert minutes → seconds for backend
      this.$emit('create', {
        userId: sessionState.user.id,
        label: this.label,
        duration,
        description: this.description
      })
      this.label = ''
      this.description = ''
      this.minutes = null
    }
  }
}
</script>
