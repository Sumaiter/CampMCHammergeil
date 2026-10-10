<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api, ApiError } from '@/api/client'
import type { ShopItem } from '@/api/types'
import { RoutePath } from '@/router/routePath'
import { formatPrice } from './price'

const items = ref<ShopItem[]>([])
const loading = ref(true)
const loadError = ref('')

// Eingaben pro Artikel-ID; leer = nicht bestellt
const quantities = ref<Record<number, number | string | null>>({})
const submitting = ref(false)
const submitError = ref('')
const submitSuccess = ref(false)

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

  submitting.value = true
  try {
    await api.post('/api/shop/orders', { items: selected })
    quantities.value = {}
    submitSuccess.value = true
  } catch (err) {
    submitError.value = errorText(err, 'Bestellung konnte nicht gespeichert werden')
  } finally {
    submitting.value = false
  }
}

onMounted(loadItems)
</script>

<template>
  <div class="page-section shopping">
    <h1 class="page-title">Einkaufen</h1>

    <form class="card glass-card" @submit.prevent="submit">
      <p v-if="loadError" class="form-error" role="alert">{{ loadError }}</p>
      <p v-else-if="!loading && items.length === 0" class="empty">
        Es sind noch keine Artikel verfügbar.
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
        Deine Bestellung wurde gespeichert.
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
