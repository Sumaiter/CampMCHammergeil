// Benutzerliste für Auswahlfelder ("Für wen?" / "Übersicht anzeigen für"), mit mir selbst zuerst.
import { computed, ref } from 'vue'
import { api, errorMessage } from '@/api/client'
import type { ShopUser } from '@/api/types'
import { useAuth } from '@/auth/useAuth'

export function useShopUsers(onLoaded?: () => void) {
  const { user } = useAuth()
  const meId = computed(() => user.value?.id ?? 0)

  const users = ref<ShopUser[]>([])
  const usersError = ref('')

  async function loadUsers() {
    try {
      const data = await api.get<{ users: ShopUser[] }>('/api/shop/users')
      users.value = data.users
      onLoaded?.()
      usersError.value = ''
    } catch (err) {
      usersError.value = errorMessage(err, 'Benutzer konnten nicht geladen werden')
    }
  }

  // "Mich selbst (name)" zuerst, danach alle anderen in Serverreihenfolge
  const userOptions = computed(() => {
    const me = users.value.find((entry) => entry.id === meId.value)
    const others = users.value.filter((entry) => entry.id !== meId.value)
    return [
      { id: meId.value, label: `Mich selbst (${me?.username ?? user.value?.username ?? ''})` },
      ...others.map((entry) => ({ id: entry.id, label: entry.username })),
    ]
  })

  return { meId, users, usersError, loadUsers, userOptions }
}
