<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const user = ref('')
const password = ref('')

const login = () => {
  console.log('Login:', user.value, password.value)
  router.push('/')
}
</script>

<template>
  <div class="login-wrapper">
    <div class="login-card">
      <h1>Login</h1>

      <input v-model="user" placeholder="User" />
      <input v-model="password" type="password" placeholder="Passwort" />

      <button @click="login">Login</button>
    </div>
  </div>
</template>

<style scoped>
/* 🌍 WRAPPER (RESPONSIVE CENTERING) */
.login-wrapper {
  width: 100%;
  min-height: 70vh;
  min-height: 70dvh;

  display: flex;
  justify-content: center;
  align-items: center;

  padding: 4%;
  box-sizing: border-box;
  background: transparent;
}

/* 🧠 CARD (FLUID SCALE) */
.login-card {
  width: 80%;
  max-width: 360px;

  padding: 6%;
  border-radius: 12px;

  background: rgba(0, 0, 0, 0.6);
  color: white;

  display: flex;
  flex-direction: column;

  gap: 4%;

  box-sizing: border-box;
}

/* ✍️ TITLE */
.login-card h1 {
  font-size: clamp(1.4rem, 5vw, 2rem);
  margin: 0;
}

/* 🧾 INPUTS */
input {
  width: 100%;

  padding: 3%;
  border-radius: 8px;
  border: none;

  font-size: 1rem;

  box-sizing: border-box;
}

/* 🔘 BUTTON */
button {
  width: 100%;

  padding: 3%;
  border: none;
  border-radius: 8px;

  background: #2aa87a;
  color: white;

  cursor: pointer;

  font-size: 1rem;

  transition:
    transform 0.15s ease,
    filter 0.15s ease;
}

/* interaction */
button:hover,
button:active {
  transform: scale(1.03);
  filter: brightness(1.1);
}

/* 📱 MOBILE FINE TUNING */
@media (max-width: 600px) {
  .login-card {
    width: 90%;
    padding: 7%;
  }
}
</style>
