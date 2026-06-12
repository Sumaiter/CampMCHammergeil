<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const email = ref('')
const password = ref('')

const login = () => {
  // Fake login → später ersetzen
  console.log('Login:', email.value, password.value)

  router.push('/')
}
</script>

<template>
  <div class="login-wrapper">
    <div class="login-card">
      <h1>Login</h1>

      <input v-model="email" placeholder="E-Mail" />
      <input v-model="password" type="password" placeholder="Passwort" />

      <button @click="login">Login</button>
    </div>
  </div>
</template>

<style scoped>
.login-wrapper {
  height: 35vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: transparent;
}

.login-card {
  padding: 2rem;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 300px;
}

input {
  padding: 0.5rem;
  border-radius: 6px;
  border: none;
}

button {
  padding: 0.6rem;
  border: none;
  border-radius: 6px;
  background: #2aa87a;
  color: white;
  cursor: pointer;
}
</style>
