<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError } from '@/api/client'
import { useAuth } from '@/auth/useAuth'
import { safeRedirect } from '@/router/guard'

const route = useRoute()
const router = useRouter()
const { login } = useAuth()

const user = ref('')
const password = ref('')
const error = ref('')
const pending = ref(false)

async function submit() {
  error.value = ''
  pending.value = true
  try {
    await login(user.value, password.value)
    // Zurück zur ursprünglich gewünschten Seite (nur interne Pfade)
    await router.replace(safeRedirect(route.query.redirect))
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Login fehlgeschlagen'
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="page-section login-wrapper">
    <form class="login-card glass-card" @submit.prevent="submit">
      <h1 class="page-title">Login</h1>

      <label class="form-field">
        <span>User</span>
        <input
          v-model="user"
          class="form-input"
          name="username"
          autocomplete="username"
          placeholder="User"
          required
        />
      </label>

      <label class="form-field">
        <span>Passwort</span>
        <input
          v-model="password"
          class="form-input"
          name="password"
          type="password"
          autocomplete="current-password"
          placeholder="Passwort"
          required
        />
      </label>

      <p v-if="error" class="form-error" role="alert">{{ error }}</p>

      <button type="submit" class="btn" :disabled="pending">
        {{ pending ? 'Einloggen…' : 'Login' }}
      </button>
    </form>
  </div>
</template>

<style scoped lang="scss">
.login-wrapper {
  display: flex;
  justify-content: center;
}

.login-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  max-width: 380px;
  padding: clamp(1.5rem, 6vw, 2.25rem);

  .page-title {
    margin-bottom: 0.25rem;
  }

  .btn {
    margin-top: 0.5rem;
  }
}
</style>
