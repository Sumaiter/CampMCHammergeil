<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api, errorMessage } from '@/api/client'
import type { ShopOrder } from '@/api/types'
import { useAuth } from '@/auth/useAuth'
import { RoutePath } from '@/router/routePath'
import { formatDateTime } from './date'
import { formatLineTotal, orderHint, ownTotal } from './orders'
import { formatPrice } from './price'
import { useOrderEdit } from './useOrderEdit'

const { user } = useAuth()
const meId = computed(() => user.value?.id ?? 0)

const orders = ref<ShopOrder[]>([])
const loading = ref(true)
const loadError = ref('')

const own = computed(() => ownTotal(orders.value, meId.value))
const hasOthers = computed(() => orders.value.some((order) => order.userId !== meId.value))

// Bei 404/409 ist die Position nicht mehr offen (gedruckt oder gelöscht) -> Liste neu laden
const { actionError, busyId, drafts, syncDrafts, isChanged, save, remove } = useOrderEdit({
  basePath: '/api/shop/orders',
  onSaved: (order) => {
    const index = orders.value.findIndex((entry) => entry.id === order.id)
    if (index !== -1) orders.value[index] = order
  },
  onRemoved: (order) => {
    orders.value = orders.value.filter((entry) => entry.id !== order.id)
  },
  onStale: () => loadOrders(),
})

async function loadOrders() {
  try {
    const data = await api.get<{ orders: ShopOrder[] }>('/api/shop/orders')
    orders.value = data.orders
    syncDrafts(data.orders)
    loadError.value = ''
  } catch (err) {
    loadError.value = errorMessage(err, 'Bestellungen konnten nicht geladen werden')
  } finally {
    loading.value = false
  }
}

onMounted(loadOrders)
</script>

<template>
  <div class="page-section shopping-list">
    <h1 class="page-title">Aktuelle Liste</h1>

    <section class="shop-card glass-card">
      <p class="hint">
        Solange die Liste nicht gedruckt wurde, kannst du Mengen ändern oder Positionen löschen.
        Danach findest du sie in der Übersicht.
      </p>

      <p v-if="loadError" class="form-error" role="alert">{{ loadError }}</p>

      <p v-else-if="!loading && orders.length === 0" class="empty">
        Es ist noch nichts bestellt.
        <router-link :to="RoutePath.Shopping">Jetzt einkaufen</router-link>
      </p>

      <template v-if="orders.length > 0">
        <div class="shop-table-wrap">
          <table class="shop-table">
            <thead>
              <tr>
                <th>Artikel</th>
                <th class="num">Anzahl</th>
                <th class="num">Einzelpreis</th>
                <th class="num">Summe</th>
                <th>Zeitpunkt</th>
                <th><span class="sr-only">Aktionen</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="order in orders" :key="order.id">
                <td data-label="Artikel" class="name">
                  <span class="name-text">
                    {{ order.itemName }}
                    <small v-if="orderHint(order, meId)" class="order-hint">
                      {{ orderHint(order, meId) }}
                    </small>
                  </span>
                </td>
                <td data-label="Anzahl" class="num">
                  <input
                    v-model="drafts[order.id]"
                    class="form-input shop-qty-input"
                    type="number"
                    inputmode="numeric"
                    min="1"
                    max="999"
                    step="1"
                    :aria-label="`Anzahl für ${order.itemName}`"
                    :disabled="busyId === order.id"
                  />
                </td>
                <td data-label="Einzelpreis" class="num">{{ formatPrice(order.priceCents) }}</td>
                <td data-label="Summe" class="num">{{ formatLineTotal(order) }}</td>
                <td data-label="Zeitpunkt" class="date">{{ formatDateTime(order.createdAt) }}</td>
                <td class="actions">
                  <button
                    v-if="isChanged(order)"
                    type="button"
                    class="btn btn-small"
                    :disabled="busyId === order.id"
                    @click="save(order)"
                  >
                    Speichern
                  </button>
                  <button
                    type="button"
                    class="btn btn-secondary btn-small btn-danger"
                    :disabled="busyId === order.id"
                    @click="remove(order)"
                  >
                    Löschen
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>

        <p class="shop-total">
          <span>Deine Summe</span>
          <strong>{{ formatPrice(own.totalCents) }}</strong>
        </p>
        <p v-if="hasOthers" class="hint">
          Bestellungen, die du für andere aufgegeben hast, sind in der Summe nicht enthalten.
        </p>
        <p v-if="own.unpricedCount > 0" class="hint">
          Artikel ohne Preis sind in der Summe nicht enthalten.
        </p>
      </template>

      <p v-else-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
    </section>
  </div>
</template>

<style scoped lang="scss">
.shopping-list {
  max-width: 900px;
}

.empty,
.hint {
  color: var(--c-text-muted);
}

.empty a {
  color: var(--c-accent);
  font-weight: 700;
}
</style>
