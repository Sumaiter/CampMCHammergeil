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

// Testdaten zurücksetzen (nur Admin)
const resetError = ref('')
const resetResult = ref('')
const resetting = ref(false)

// Welcher Bereich gerade aufgeklappt ist (immer nur einer)
type Section = 'password' | 'delete' | 'reset'
const openSection = ref<Section | null>(null)

function toggle(section: Section) {
  openSection.value = openSection.value === section ? null : section
  error.value = ''
  success.value = ''
  deleteError.value = ''
  resetError.value = ''
  resetResult.value = ''
}

async function changePassword() {
  error.value = ''
  success.value = ''
  if (newPassword.value !== repeatPassword.value) {
    error.value = 'Die neuen Passwörter stimmen nicht überein'
    return
  }

  pending.value = true
  try {
    const wasForced = user.value?.mustChangePassword === true
    await api.post('/api/auth/password', {
      ...(wasForced ? {} : { currentPassword: currentPassword.value }),
      newPassword: newPassword.value,
    })
    passwordChanged()
    currentPassword.value = ''
    newPassword.value = ''
    repeatPassword.value = ''
    if (wasForced) {
      // Sperre ist aufgehoben – weiter zur Startseite
      await routerHelper.replace(RoutePath.Home)
      return
    }
    openSection.value = null
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

async function onResetShopData() {
  resetError.value = ''
  resetResult.value = ''
  if (
    !window.confirm(
      'Wirklich ALLE Bestellungen und gedruckten Listen löschen? Das kann nicht rückgängig gemacht werden.',
    )
  ) {
    return
  }

  resetting.value = true
  try {
    const res = await api.delete<{ ok: boolean; deletedOrders: number; deletedLists: number }>(
      '/api/admin/shop-data',
    )
    resetResult.value = `${res.deletedOrders} Bestellungen und ${res.deletedLists} Listen gelöscht`
  } catch (err) {
    resetError.value =
      err instanceof ApiError ? err.message : 'Testdaten konnten nicht zurückgesetzt werden'
  } finally {
    resetting.value = false
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

    <!-- Erster Login: nur Passwortänderung, ohne aktuelles Passwort -->
    <template v-if="user?.mustChangePassword">
      <p class="notice" role="alert">
        Du musst dein Passwort ändern, bevor du fortfahren kannst. Wähle ein neues Passwort, das
        nur du kennst.
      </p>

      <form class="card glass-card" @submit.prevent="changePassword">
        <h2>Neues Passwort festlegen</h2>

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

        <button type="submit" class="btn" :disabled="pending">Passwort speichern</button>
      </form>
    </template>

    <div v-else class="sections">
      <button type="button" class="btn btn-secondary" @click="onLogout">Logout</button>

      <router-link v-if="isAdmin" :to="RoutePath.Admin" class="btn admin-link">
        Benutzerverwaltung
      </router-link>

      <p v-if="success" class="form-success" role="status">{{ success }}</p>

      <!-- Passwort ändern -->
      <button
        type="button"
        class="btn btn-secondary"
        :aria-expanded="openSection === 'password'"
        aria-controls="section-password"
        @click="toggle('password')"
      >
        Passwort ändern
      </button>
      <form
        v-if="openSection === 'password'"
        id="section-password"
        class="card glass-card"
        @submit.prevent="changePassword"
      >
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

        <div class="form-actions">
          <button type="submit" class="btn" :disabled="pending">Passwort speichern</button>
          <button type="button" class="btn btn-secondary" @click="toggle('password')">
            Abbrechen
          </button>
        </div>
      </form>

      <!-- Konto löschen -->
      <button
        type="button"
        class="btn btn-secondary btn-danger"
        :aria-expanded="openSection === 'delete'"
        aria-controls="section-delete"
        @click="toggle('delete')"
      >
        Konto löschen
      </button>
      <form
        v-if="openSection === 'delete'"
        id="section-delete"
        class="card glass-card danger-zone"
        @submit.prevent="onDeleteAccount"
      >
        <p class="hint">
          Dein Konto und dein Login werden gelöscht. Bereits aufgegebene Bestellungen und Einkäufe
          bleiben mit deinem Namen gespeichert, damit offene Zahlungen abgerechnet werden können.
          Zur Bestätigung brauchst du dein aktuelles Passwort.
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

        <div class="form-actions">
          <button type="submit" class="btn btn-secondary btn-danger" :disabled="deleting">
            {{ deleting ? 'Löschen…' : 'Konto endgültig löschen' }}
          </button>
          <button type="button" class="btn btn-secondary" @click="toggle('delete')">
            Abbrechen
          </button>
        </div>
      </form>

      <!-- Testdaten zurücksetzen (nur Admin) -->
      <template v-if="isAdmin">
        <button
          type="button"
          class="btn btn-secondary btn-danger"
          :aria-expanded="openSection === 'reset'"
          aria-controls="section-reset"
          @click="toggle('reset')"
        >
          Testdaten zurücksetzen
        </button>
        <div v-if="openSection === 'reset'" id="section-reset" class="card glass-card danger-zone">
          <p class="hint">
            Löscht alle Bestellungen und gedruckten Listen. Benutzer und Artikelliste bleiben
            erhalten. Das kann nicht rückgängig gemacht werden.
          </p>

          <p v-if="resetError" class="form-error" role="alert">{{ resetError }}</p>
          <p v-if="resetResult" class="form-success" role="status">{{ resetResult }}</p>

          <div class="form-actions">
            <button
              type="button"
              class="btn btn-secondary btn-danger"
              :disabled="resetting"
              @click="onResetShopData"
            >
              {{ resetting ? 'Löschen…' : 'Alle Bestellungen und Listen löschen' }}
            </button>
            <button type="button" class="btn btn-secondary" @click="toggle('reset')">
              Schließen
            </button>
          </div>
        </div>
      </template>
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

.notice {
  margin-bottom: 1.25rem;
  padding: 0.85rem 1rem;
  border: 1px solid var(--c-border-strong);
  border-radius: var(--radius-sm);
  color: var(--c-accent);
}

.sections {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.danger-zone {
  border-color: rgba(255, 138, 138, 0.35);

  .hint {
    font-size: 0.9rem;
    color: var(--c-text-muted);
  }
}

.form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;

  .btn {
    flex: 1 1 140px;
  }
}

.admin-link {
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
}
</style>
