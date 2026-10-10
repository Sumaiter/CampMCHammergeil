<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api, errorMessage } from '@/api/client'
import type { ShopItem } from '@/api/types'
import { RoutePath } from '@/router/routePath'
import QuantityStepper from './QuantityStepper.vue'
import { formatPrice } from './price'
import { useShopUsers } from './useShopUsers'

// Empfänger der Bestellung; vorbelegt mit mir selbst, sobald die Benutzer geladen sind
const recipientId = ref<number | null>(null)
const { meId, users, usersError, loadUsers, userOptions } = useShopUsers(() => {
  recipientId.value ??= meId.value
})

const items = ref<ShopItem[]>([])
const loading = ref(true)
const loadError = ref('')

// Eingaben pro Artikel-ID (unabhängig vom Suchfilter); fehlt/0 = nicht bestellt
const quantities = ref<Record<number, number>>({})
const search = ref('')
// Reihenfolge vom Server (nach Beliebtheit) bleibt erhalten
const visibleItems = computed(() => {
  const term = search.value.trim().toLowerCase()
  return term ? items.value.filter((item) => item.name.toLowerCase().includes(term)) : items.value
})
const submitting = ref(false)
const submitError = ref('')
const submitSuccess = ref(false)
// Empfänger der zuletzt gespeicherten Bestellung, nur wenn es nicht ich selbst war
const successRecipient = ref('')

async function loadItems() {
  try {
    const data = await api.get<{ items: ShopItem[] }>('/api/shop/items')
    items.value = data.items
    loadError.value = ''
  } catch (err) {
    loadError.value = errorMessage(err, 'Artikel konnten nicht geladen werden')
  } finally {
    loading.value = false
  }
}

function quantityOf(id: number): number {
  return quantities.value[id] ?? 0
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
    submitError.value = errorMessage(err, 'Bestellung konnte nicht gespeichert werden')
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

    <form class="shop-card glass-card" @submit.prevent="submit">
      <p v-if="loadError" class="form-error" role="alert">{{ loadError }}</p>
      <p v-else-if="!loading && items.length === 0" class="empty">
        Es sind noch keine Artikel verfügbar.
      </p>

      <label v-if="items.length > 0 && users.length > 0" class="form-field recipient">
        <span>Für wen?</span>
        <select v-model="recipientId" class="form-input">
          <option v-for="option in userOptions" :key="option.id" :value="option.id">
            {{ option.label }}
          </option>
        </select>
      </label>
      <p v-else-if="usersError" class="form-error" role="alert">
        {{ usersError }} – du bestellst für dich selbst.
      </p>

      <label v-if="items.length > 0" class="form-field">
        <span>Artikel suchen</span>
        <input
          v-model="search"
          class="form-input"
          type="search"
          autocomplete="off"
          placeholder="Name eingeben …"
        />
      </label>

      <p v-if="items.length > 0 && visibleItems.length === 0" class="empty">
        Kein Artikel gefunden.
      </p>

      <ul v-if="visibleItems.length > 0" class="shop-plain-list">
        <li v-for="item in visibleItems" :key="item.id" class="item-row">
          <div class="shop-item-info">
            <strong class="item-name">{{ item.name }}</strong>
            <small>{{ formatPrice(item.priceCents) }}</small>
          </div>

          <QuantityStepper
            :model-value="quantityOf(item.id)"
            :max="999"
            :label="`Anzahl für ${item.name}`"
            @update:model-value="quantities[item.id] = $event"
          />
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

.empty {
  color: var(--c-text-muted);
}

.item-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0;

  & + & {
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }
}

.form-success a {
  color: inherit;
  font-weight: 700;
  text-decoration: underline;
}

</style>
