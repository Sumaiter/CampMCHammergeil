<script setup lang="ts">
import { ref } from 'vue'
import { api, ApiError } from '@/api/client'
import { useAuth } from '@/auth/useAuth'
import { routerHelper } from '@/router/routerHelper'
import { RoutePath } from '@/router/routePath'

const { user, isAdmin, logout } = useAuth()

const currentPassword = ref('')
const newPassword = ref('')
const repeatPassword = ref('')
const error = ref('')
const success = ref('')
const pending = ref(false)

async function changePassword() {
  error.value = ''
  success.value = ''
  if (newPassword.value !== repeatPassword.value) {
    error.value = 'Die neuen Passwörter stimmen nicht überein'
    return
  }

  pending.value = true
  try {
    await api.post('/api/auth/password', {
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
    })
    success.value = 'Passwort geändert.'
    currentPassword.value = ''
    newPassword.value = ''
    repeatPassword.value = ''
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Passwort konnte nicht geändert werden'
  } finally {
    pending.value = false
  }
}

async function onLogout() {
  await logout()
  await routerHelper.replace(RoutePath.Home)
}
</script>

<template>
  <div class="page-section account">
    <h1 class="page-title">Hallo, {{ user?.username }}</h1>

    <form class="card glass-card" @submit.prevent="changePassword">
      <h2>Passwort ändern</h2>

      <label class="form-field">
        <span>Aktuelles Passwort</span>
        <input
          v-model="currentPassword"
          class="form-input"
          type="password"
          autocomplete="current-password"
          required
        />
      </label>

      <label class="form-field">
        <span>Neues Passwort</span>
        <input
          v-model="newPassword"
          class="form-input"
          type="password"
          autocomplete="new-password"
          minlength="8"
          maxlength="128"
          required
        />
      </label>

      <label class="form-field">
        <span>Neues Passwort wiederholen</span>
        <input
          v-model="repeatPassword"
          class="form-input"
          type="password"
          autocomplete="new-password"
          required
        />
      </label>

      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <p v-if="success" class="form-success" role="status">{{ success }}</p>

      <button type="submit" class="btn" :disabled="pending">Passwort speichern</button>
    </form>

    <div class="actions">
      <router-link v-if="isAdmin" :to="RoutePath.Admin" class="btn admin-link">
        Benutzerverwaltung
      </router-link>
      <button type="button" class="btn btn-secondary" @click="onLogout">Logout</button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.account {
  max-width: 480px;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: clamp(1.25rem, 5vw, 2rem);

  h2 {
    font-size: 1.15rem;
    color: var(--c-accent);
  }
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1.25rem;

  .btn {
    flex: 1 1 180px;
  }
}

.admin-link {
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
}
</style>
