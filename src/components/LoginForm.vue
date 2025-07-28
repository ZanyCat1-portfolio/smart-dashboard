<template>
  <form @submit.prevent="handleLogin">
    <div>
      <label>Username</label>
      <input v-model="username" type="text" required />
    </div>
    <div>
      <label>Password</label>
      <input v-model="password" type="password" required />
    </div>
    <button type="submit">Login</button>
    <p v-if="error">{{ error }}</p>
  </form>
</template>

<script setup>
import { ref } from 'vue'
import { useSession } from '../composables/useSessions'

const emit = defineEmits(['login-success'])

const username = ref('')
const password = ref('')
const error = ref('')

const { login } = useSession()

async function handleLogin() {
  error.value = ''
  const user = await login(username.value, password.value)
  if (!user) {
    error.value = 'Invalid username or password'
  } else {
    emit('login-success', user)
  }
}
</script>
