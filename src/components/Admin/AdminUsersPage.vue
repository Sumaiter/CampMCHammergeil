<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api, ApiError } from '@/api/client'
import type { AdminUser } from '@/api/types'
import { useAuth } from '@/auth/useAuth'

const { user: currentUser } = useAuth()

const users = ref<AdminUser[]>([])
const listError = ref('')

// Formular "Benutzer anlegen"
const newUsername = ref('')
const newPassword = ref('')
const createError = ref('')
const createSuccess = ref('')
const creating = ref(false)

// Zeilenaktionen (immer nur ein Reset-Feld gleichzeitig offen)
const resetId = ref<number | null>(null)
const resetPassword = ref('')
const rowMessage = ref<{ id: number; text: string; error: boolean } | null>(null)
const busyId = ref<number | null>(null)

const dateFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' })
// D1 liefert UTC im Format "YYYY-MM-DD HH:MM:SS"
const formatDate = (value: string) => dateFormat.format(new Date(value.replace(' ', 'T') + 'Z'))

const errorText = (err: unknown, fallback: string) =>
  err instanceof ApiError ? err.message : fallback

async function loadUsers() {
  try {
    const data = await api.get<{ users: AdminUser[] }>('/api/admin/users')
    users.value = data.users
    listError.value = ''
  } catch (err) {
    listError.value = errorText(err, 'Benutzer konnten nicht geladen werden')
  }
}

async function createUser() {
  createError.value = ''
  createSuccess.value = ''
  creating.value = true
  try {
    const data = await api.post<{ user: AdminUser }>('/api/admin/users', {
      username: newUsername.value,
      password: newPassword.value,
    })
    createSuccess.value = `Benutzer „${data.user.username}“ angelegt. Das Startpasswort muss beim ersten Login geändert werden.`
    newUsername.value = ''
    newPassword.value = ''
    await loadUsers()
  } catch (err) {
    createError.value = errorText(err, 'Benutzer konnte nicht angelegt werden')
  } finally {
    creating.value = false
  }
}

function openReset(id: number) {
  resetId.value = id
  resetPassword.value = ''
  rowMessage.value = null
}

function closeReset() {
  resetId.value = null
  resetPassword.value = ''
}

async function saveReset(target: AdminUser) {
  busyId.value = target.id
  try {
    await api.post(`/api/admin/users/${target.id}/password`, { password: resetPassword.value })
    closeReset()
    rowMessage.value = {
      id: target.id,
      text: `Passwort für „${target.username}“ zurückgesetzt. Es muss beim nächsten Login geändert werden.`,
      error: false,
    }
  } catch (err) {
    rowMessage.value = {
      id: target.id,
      text: errorText(err, 'Passwort konnte nicht zurückgesetzt werden'),
      error: true,
    }
  } finally {
    busyId.value = null
  }
}

async function deleteUser(target: AdminUser) {
  if (!confirm(`Benutzer „${target.username}“ wirklich löschen?`)) return
  busyId.value = target.id
  rowMessage.value = null
  try {
    await api.delete(`/api/admin/users/${target.id}`)
    if (resetId.value === target.id) closeReset()
    await loadUsers()
  } catch (err) {
    rowMessage.value = {
      id: target.id,
      text: errorText(err, 'Benutzer konnte nicht gelöscht werden'),
      error: true,
    }
  } finally {
    busyId.value = null
  }
}

onMounted(loadUsers)
</script>

<template>
  <div class="page-section admin">
    <h1 class="page-title">Benutzerverwaltung</h1>

    <form class="card glass-card" @submit.prevent="createUser">
      <h2>Benutzer anlegen</h2>

      <div class="create-fields">
        <label class="form-field">
          <span>Benutzername</span>
          <input
            v-model="newUsername"
            class="form-input"
            autocomplete="off"
            minlength="3"
            maxlength="32"
            required
          />
        </label>

        <label class="form-field">
          <span>Startpasswort</span>
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
      </div>

      <p v-if="createError" class="form-error" role="alert">{{ createError }}</p>
      <p v-if="createSuccess" class="form-success" role="status">{{ createSuccess }}</p>

      <button type="submit" class="btn" :disabled="creating">Anlegen</button>
    </form>

    <section class="card glass-card">
      <h2>Benutzer</h2>

      <p v-if="listError" class="form-error" role="alert">{{ listError }}</p>

      <ul class="user-list">
        <li v-for="item in users" :key="item.id" class="user-row">
          <div class="user-info">
            <strong class="user-name">{{ item.username }}</strong>
            <span v-if="item.isAdmin" class="badge">Admin</span>
            <small>Erstellt am {{ formatDate(item.createdAt) }}</small>
          </div>

          <div class="user-actions">
            <button
              type="button"
              class="btn btn-secondary btn-small"
              :disabled="busyId === item.id"
              @click="openReset(item.id)"
            >
              Passwort zurücksetzen
            </button>
            <button
              v-if="item.id !== currentUser?.id"
              type="button"
              class="btn btn-secondary btn-small btn-danger"
              :disabled="busyId === item.id"
              @click="deleteUser(item)"
            >
              Löschen
            </button>
          </div>

          <form v-if="resetId === item.id" class="reset-form" @submit.prevent="saveReset(item)">
            <label class="form-field">
              <span>Neues Passwort für {{ item.username }}</span>
              <input
                v-model="resetPassword"
                class="form-input"
                type="password"
                autocomplete="new-password"
                minlength="8"
                maxlength="128"
                required
              />
            </label>
            <div class="reset-buttons">
              <button type="submit" class="btn btn-small" :disabled="busyId === item.id">
                Speichern
              </button>
              <button type="button" class="btn btn-secondary btn-small" @click="closeReset">
                Abbrechen
              </button>
            </div>
          </form>

          <p
            v-if="rowMessage?.id === item.id"
            :class="rowMessage.error ? 'form-error' : 'form-success'"
            :role="rowMessage.error ? 'alert' : 'status'"
          >
            {{ rowMessage.text }}
          </p>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped lang="scss">
.admin {
  max-width: 720px;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: clamp(1.25rem, 5vw, 2rem);

  & + & {
    margin-top: 1.25rem;
  }

  h2 {
    font-size: 1.15rem;
    color: var(--c-accent);
  }
}

.create-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.user-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.user-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.9rem 0;

  & + & {
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .reset-form,
  > p {
    grid-column: 1 / -1;
  }
}

.user-info {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.25rem 0.6rem;
  min-width: 0;

  .user-name {
    overflow-wrap: anywhere;
  }

  small {
    flex-basis: 100%;
    color: var(--c-text-muted);
  }
}

.badge {
  padding: 0.1rem 0.5rem;
  border: 1px solid var(--c-border-strong);
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--c-accent);
}

.user-actions,
.reset-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.reset-form {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.btn-small {
  min-height: 40px;
  padding: 0.5rem 0.85rem;
  font-size: 0.9rem;
}

/* 📱 MOBILE: Felder und Aktionen untereinander */
@media (max-width: 600px) {
  .create-fields {
    grid-template-columns: 1fr;
  }

  .user-row {
    grid-template-columns: 1fr;
  }

  .user-actions .btn,
  .reset-buttons .btn {
    flex: 1 1 auto;
  }
}
</style>
