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

<script>
import { useSession } from '../composables/useSessions'

export default {
  name: 'LoginForm',
  data() {
    return {
      username: '',
      password: '',
      error: ''
    }
  },
  methods: {
    async handleLogin() {
      this.error = ''
      const { login } = useSession()
      const user = await login(this.username, this.password)
      console.log("What is user?", user)
      if (!user) {
        this.error = 'Invalid username or password'
      } else {
        this.$emit('login-success', user)
      }
    }
  }
}
</script>
