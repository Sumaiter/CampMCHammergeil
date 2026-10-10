import { computed, readonly, ref } from 'vue'
import { api, ApiError, onUnauthorized } from '@/api/client'
import type { User } from '@/api/types'

// Globaler Login-Zustand – einmal pro Seitenaufruf vom Server geladen.
const user = ref<User | null>(null)
const isAdmin = computed(() => user.value?.isAdmin ?? false)
let loading: Promise<void> | undefined

onUnauthorized(() => {
  user.value = null
})

function ensureLoaded(): Promise<void> {
  loading ??= api
    .get<{ user: User | null }>('/api/auth/me')
    .then((data) => {
      user.value = data.user
    })
    .catch(() => {
      user.value = null
      loading = undefined // beim nächsten Seitenwechsel erneut versuchen
    })
  return loading
}

async function login(username: string, password: string): Promise<void> {
  const data = await api.post<{ user: User }>('/api/auth/login', { username, password })
  user.value = data.user
  loading = Promise.resolve()
}

// Nach erfolgreicher Passwortänderung: Sperre im lokalen Zustand aufheben.
function passwordChanged(): void {
  if (user.value) user.value = { ...user.value, mustChangePassword: false }
}

// Löscht das eigene Konto (Passwort zur Bestätigung) und beendet die lokale Sitzung.
async function deleteAccount(password: string): Promise<void> {
  await api.delete('/api/auth/account', { password })
  user.value = null
}

async function logout(): Promise<void> {
  try {
    await api.post('/api/auth/logout')
  } catch (err) {
    // 401: Session war schon beendet (abgelaufen, Passwort-Reset) – Ziel ist also erreicht.
    if (!(err instanceof ApiError && err.status === 401)) throw err
  } finally {
    user.value = null
  }
}

export function useAuth() {
  return {
    user: readonly(user),
    isAdmin,
    ensureLoaded,
    login,
    logout,
    passwordChanged,
    deleteAccount,
  }
}
