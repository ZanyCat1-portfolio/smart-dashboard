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
    <p v-if="success" class="text-success">Registered successfully! Please log in.</p>
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
const success = ref(false)

const { register } = useSession()

async function handleRegister() {
  error.value = ''
  success.value = false
  if (password.value !== confirm.value) {
    error.value = 'Passwords do not match'
    return
  }
  const result = await register(username.value, password.value) 
  if (result) {
    success.value = true
    // Optionally clear fields
    username.value = ''
    password.value = ''
    confirm.value = ''
  } else {
    error.value = 'Username already exists or other error'
  }
  // const user = await register(username.value, password.value)
  // if (!user) {
  //   error.value = 'Username already exists or other error'
  // } else {
  //   emit('register-success', user)
  // }
}
</script>
