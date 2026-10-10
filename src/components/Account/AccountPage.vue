<script setup lang="ts">
import { ref } from 'vue'
import { api, ApiError } from '@/api/client'
import { useAuth } from '@/auth/useAuth'
import { routerHelper } from '@/router/routerHelper'
import { RoutePath } from '@/router/routePath'

const { user, isAdmin, logout, passwordChanged, deleteAccount } = useAuth()

const currentPassword = ref('')
const newPassword = ref('')
const repeatPassword = ref('')
const error = ref('')
const success = ref('')
const pending = ref(false)

// Konto löschen
const deletePassword = ref('')
const deleteError = ref('')
const deleting = ref(false)

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
    const wasForced = user.value?.mustChangePassword === true
    passwordChanged()
    currentPassword.value = ''
    newPassword.value = ''
    repeatPassword.value = ''
    if (wasForced) {
      // Sperre ist aufgehoben – weiter zur Startseite
      await routerHelper.replace(RoutePath.Home)
      return
    }
    success.value = 'Passwort geändert.'
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Passwort konnte nicht geändert werden'
  } finally {
    pending.value = false
  }
}

async function onDeleteAccount() {
  deleteError.value = ''
  if (
    !confirm('Dein Konto wirklich endgültig löschen? Das kann nicht rückgängig gemacht werden.')
  ) {
    return
  }

  deleting.value = true
  try {
    await deleteAccount(deletePassword.value)
    await routerHelper.replace(RoutePath.Home)
  } catch (err) {
    deleteError.value = err instanceof ApiError ? err.message : 'Konto konnte nicht gelöscht werden'
  } finally {
    deleting.value = false
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

    <p v-if="user?.mustChangePassword" class="notice" role="alert">
      Du musst dein Passwort ändern, bevor du fortfahren kannst. Wähle ein neues Passwort, das nur
      du kennst.
    </p>

    <form class="card glass-card" @submit.prevent="changePassword">
      <h2>Passwort ändern</h2>

      <label class="form-field">
        <span>{{ user?.mustChangePassword ? 'Vorläufiges Passwort' : 'Aktuelles Passwort' }}</span>
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
      <router-link
        v-if="isAdmin && !user?.mustChangePassword"
        :to="RoutePath.Admin"
        class="btn admin-link"
      >
        Benutzerverwaltung
      </router-link>
      <button type="button" class="btn btn-secondary" @click="onLogout">Logout</button>
    </div>

    <form class="card glass-card danger-zone" @submit.prevent="onDeleteAccount">
      <h2>Konto löschen</h2>
      <p class="hint">
        Dein Konto und alle zugehörigen Daten werden endgültig gelöscht. Zur Bestätigung brauchst du
        dein aktuelles Passwort.
      </p>

      <label class="form-field">
        <span>Passwort</span>
        <input
          v-model="deletePassword"
          class="form-input"
          type="password"
          autocomplete="current-password"
          required
        />
      </label>

      <p v-if="deleteError" class="form-error" role="alert">{{ deleteError }}</p>

      <button type="submit" class="btn btn-secondary btn-danger" :disabled="deleting">
        {{ deleting ? 'Löschen…' : 'Konto löschen' }}
      </button>
    </form>
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

.notice {
  margin-bottom: 1.25rem;
  padding: 0.85rem 1rem;
  border: 1px solid var(--c-border-strong);
  border-radius: var(--radius-sm);
  color: var(--c-accent);
}

.danger-zone {
  margin-top: 1.25rem;
  border-color: rgba(255, 138, 138, 0.35);

  h2 {
    color: #ff8a8a;
  }

  .hint {
    font-size: 0.9rem;
    color: var(--c-text-muted);
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
