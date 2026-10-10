<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api, ApiError } from '@/api/client'
import type { ShopItem, ShopUser } from '@/api/types'
import { useAuth } from '@/auth/useAuth'
import { RoutePath } from '@/router/routePath'
import { formatPrice } from './price'

const { user } = useAuth()
const meId = computed(() => user.value?.id ?? 0)

const items = ref<ShopItem[]>([])
const users = ref<ShopUser[]>([])
const usersError = ref('')
// Empfänger der Bestellung; vorbelegt mit mir selbst, sobald die Benutzer geladen sind
const recipientId = ref<number | null>(null)
const loading = ref(true)
const loadError = ref('')

// Eingaben pro Artikel-ID; leer = nicht bestellt
const quantities = ref<Record<number, number | string | null>>({})
const submitting = ref(false)
const submitError = ref('')
const submitSuccess = ref(false)
// Empfänger der zuletzt gespeicherten Bestellung, nur wenn es nicht ich selbst war
const successRecipient = ref('')

const errorText = (err: unknown, fallback: string) =>
  err instanceof ApiError ? err.message : fallback

async function loadItems() {
  try {
    const data = await api.get<{ items: ShopItem[] }>('/api/shop/items')
    items.value = data.items
    loadError.value = ''
  } catch (err) {
    loadError.value = errorText(err, 'Artikel konnten nicht geladen werden')
  } finally {
    loading.value = false
  }
}

async function loadUsers() {
  try {
    const data = await api.get<{ users: ShopUser[] }>('/api/shop/users')
    users.value = data.users
    recipientId.value ??= meId.value
    usersError.value = ''
  } catch (err) {
    usersError.value = errorText(err, 'Benutzer konnten nicht geladen werden')
  }
}

// "Mich selbst (name)" zuerst, danach alle anderen in Serverreihenfolge
const recipientOptions = computed(() => {
  const me = users.value.find((entry) => entry.id === meId.value)
  const others = users.value.filter((entry) => entry.id !== meId.value)
  return [
    { id: meId.value, label: `Mich selbst (${me?.username ?? user.value?.username ?? ''})` },
    ...others.map((entry) => ({ id: entry.id, label: entry.username })),
  ]
})

function quantityOf(id: number): number {
  const value = Number(quantities.value[id])
  return Number.isFinite(value) ? Math.floor(value) : 0
}

async function submit() {
  submitError.value = ''
  submitSuccess.value = false

  const selected = items.value
    .map((item) => ({ itemId: item.id, quantity: quantityOf(item.id) }))
    .filter((entry) => entry.quantity > 0)

  if (selected.length === 0) {
    submitError.value = 'Bitte gib bei mindestens einem Artikel eine Anzahl ein.'
    return
  }
  if (selected.some((entry) => entry.quantity > 999)) {
    submitError.value = 'Die Anzahl darf höchstens 999 betragen.'
    return
  }

  const other =
    recipientId.value !== null && recipientId.value !== meId.value
      ? users.value.find((entry) => entry.id === recipientId.value)
      : undefined

  submitting.value = true
  try {
    await api.post('/api/shop/orders', {
      ...(other ? { forUserId: other.id } : {}),
      items: selected,
    })
    quantities.value = {}
    successRecipient.value = other?.username ?? ''
    submitSuccess.value = true
  } catch (err) {
    submitError.value = errorText(err, 'Bestellung konnte nicht gespeichert werden')
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  void loadItems()
  void loadUsers()
})
</script>

<template>
  <div class="page-section shopping">
    <h1 class="page-title">Einkaufen</h1>

    <form class="card glass-card" @submit.prevent="submit">
      <p v-if="loadError" class="form-error" role="alert">{{ loadError }}</p>
      <p v-else-if="!loading && items.length === 0" class="empty">
        Es sind noch keine Artikel verfügbar.
      </p>

      <label v-if="items.length > 0 && users.length > 0" class="form-field recipient">
        <span>Für wen?</span>
        <select v-model="recipientId" class="form-input">
          <option v-for="option in recipientOptions" :key="option.id" :value="option.id">
            {{ option.label }}
          </option>
        </select>
      </label>
      <p v-else-if="usersError" class="form-error" role="alert">
        {{ usersError }} – du bestellst für dich selbst.
      </p>

      <ul v-if="items.length > 0" class="item-list">
        <li v-for="item in items" :key="item.id" class="item-row">
          <div class="item-info">
            <strong class="item-name">{{ item.name }}</strong>
            <small>{{ formatPrice(item.priceCents) }}</small>
          </div>

          <label class="quantity">
            <span class="sr-only">Anzahl für {{ item.name }}</span>
            <input
              v-model="quantities[item.id]"
              class="form-input"
              type="number"
              inputmode="numeric"
              min="0"
              max="999"
              step="1"
              placeholder="Anzahl"
            />
          </label>
        </li>
      </ul>

      <p v-if="submitError" class="form-error" role="alert">{{ submitError }}</p>
      <p v-if="submitSuccess" class="form-success" role="status">
        <template v-if="successRecipient">
          Die Bestellung für {{ successRecipient }} wurde gespeichert.
        </template>
        <template v-else>Deine Bestellung wurde gespeichert.</template>
        <router-link :to="RoutePath.ShoppingList">Zur aktuellen Liste</router-link>
      </p>

      <button v-if="items.length > 0" type="submit" class="btn" :disabled="submitting">
        Bestätigen
      </button>
    </form>
  </div>
</template>

<style scoped lang="scss">
.shopping {
  max-width: 720px;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: clamp(1.25rem, 5vw, 2rem);
}

.empty {
  color: var(--c-text-muted);
}

.recipient select option {
  background: #111a16;
  color: var(--c-text);
}

.item-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.item-row {
  display: grid;
  grid-template-columns: 1fr 7.5rem;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0;

  & + & {
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }
}

.item-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;

  .item-name {
    overflow-wrap: anywhere;
  }

  small {
    color: var(--c-text-muted);
  }
}

.quantity .form-input {
  text-align: right;
}

.form-success a {
  color: inherit;
  font-weight: 700;
  text-decoration: underline;
}

/* 📱 MOBILE: schmaleres Mengenfeld */
@media (max-width: 600px) {
  .item-row {
    grid-template-columns: 1fr 6rem;
  }
}
</style>
