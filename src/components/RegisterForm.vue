<template>
  <form @submit.prevent="handleRegister">
    <div>
      <label>Username</label>
      <input v-model="username" type="text" required />
    </div>
    <div>
      <label>Password</label>
      <input v-model="password" type="password" required />
    </div>
    <div>
      <label>Confirm Password</label>
      <input v-model="confirm" type="password" required />
    </div>
    <button type="submit">Register</button>
    <p v-if="error">{{ error }}</p>
  </form>
</template>

<script setup>
import { ref } from 'vue'
import { useSession } from '../composables/useSessions'

const emit = defineEmits(['register-success'])

const username = ref('')
const password = ref('')
const confirm = ref('')
const error = ref('')

const { register } = useSession()

async function handleRegister() {
  error.value = ''
  if (password.value !== confirm.value) {
    error.value = 'Passwords do not match'
    return
  }
  const user = await register(username.value, password.value)
  if (!user) {
    error.value = 'Username already exists or other error'
  } else {
    emit('register-success', user)
  }
}
</script>
