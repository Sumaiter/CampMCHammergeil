<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api, ApiError } from '@/api/client'
import type { ShopOrder } from '@/api/types'
import { useAuth } from '@/auth/useAuth'
import { RoutePath } from '@/router/routePath'
import { formatPrice } from './price'
import { formatDateTime, formatLineTotal, orderHint, ownTotal } from './user-orders'

const { user } = useAuth()
const meId = computed(() => user.value?.id ?? 0)

const orders = ref<ShopOrder[]>([])
const loading = ref(true)
const loadError = ref('')
const actionError = ref('')
// Zeile, die gerade gespeichert oder gelöscht wird
const busyId = ref<number | null>(null)

// Eingaben im Mengenfeld pro Bestell-ID (vorbelegt mit der gespeicherten Menge)
const drafts = ref<Record<number, number | string | null>>({})

const errorText = (err: unknown, fallback: string) =>
  err instanceof ApiError ? err.message : fallback

const own = computed(() => ownTotal(orders.value, meId.value))
const hasOthers = computed(() => orders.value.some((order) => order.userId !== meId.value))

async function loadOrders() {
  try {
    const data = await api.get<{ orders: ShopOrder[] }>('/api/shop/orders')
    orders.value = data.orders
    drafts.value = Object.fromEntries(data.orders.map((order) => [order.id, order.quantity]))
    loadError.value = ''
  } catch (err) {
    loadError.value = errorText(err, 'Bestellungen konnten nicht geladen werden')
  } finally {
    loading.value = false
  }
}

// Gültige Menge (1..999) aus dem Eingabefeld, sonst null
function draftQuantity(order: ShopOrder): number | null {
  const raw = drafts.value[order.id] ?? order.quantity
  const value = Number(raw)
  return raw !== '' && raw !== null && Number.isInteger(value) && value >= 1 && value <= 999
    ? value
    : null
}

const isChanged = (order: ShopOrder) => draftQuantity(order) !== order.quantity

// Bei 404/409 ist die Position nicht mehr offen (gedruckt oder gelöscht) -> Liste neu laden
async function handleActionError(err: unknown, fallback: string) {
  actionError.value = errorText(err, fallback)
  if (err instanceof ApiError && (err.status === 404 || err.status === 409)) {
    await loadOrders()
  }
}

async function save(order: ShopOrder) {
  actionError.value = ''
  const quantity = draftQuantity(order)
  if (quantity === null) {
    actionError.value = 'Die Anzahl muss zwischen 1 und 999 liegen.'
    return
  }

  busyId.value = order.id
  try {
    const data = await api.put<{ order: ShopOrder }>(`/api/shop/orders/${order.id}`, { quantity })
    const index = orders.value.findIndex((entry) => entry.id === order.id)
    if (index !== -1) orders.value[index] = data.order
    drafts.value[order.id] = data.order.quantity
  } catch (err) {
    await handleActionError(err, 'Anzahl konnte nicht gespeichert werden')
  } finally {
    busyId.value = null
  }
}

async function remove(order: ShopOrder) {
  if (!confirm(`„${order.itemName}“ wirklich von der Liste löschen?`)) return
  actionError.value = ''

  busyId.value = order.id
  try {
    await api.delete(`/api/shop/orders/${order.id}`)
    orders.value = orders.value.filter((entry) => entry.id !== order.id)
    delete drafts.value[order.id]
  } catch (err) {
    await handleActionError(err, 'Bestellung konnte nicht gelöscht werden')
  } finally {
    busyId.value = null
  }
}

onMounted(loadOrders)
</script>

<template>
  <div class="page-section shopping-list">
    <h1 class="page-title">Aktuelle Liste</h1>

    <section class="card glass-card">
      <p class="hint">
        Solange der Admin die Liste nicht gedruckt hat, kannst du Mengen ändern oder Positionen
        löschen. Danach findest du sie in der Übersicht.
      </p>

      <p v-if="loadError" class="form-error" role="alert">{{ loadError }}</p>

      <p v-else-if="!loading && orders.length === 0" class="empty">
        Es ist noch nichts bestellt.
        <router-link :to="RoutePath.Shopping">Jetzt einkaufen</router-link>
      </p>

      <template v-if="orders.length > 0">
        <div class="table-wrap">
          <table class="orders">
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
                    class="form-input qty-input"
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

        <p class="total">
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

.card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: clamp(1.25rem, 5vw, 2rem);
}

.empty,
.hint {
  color: var(--c-text-muted);
}

.empty a {
  color: var(--c-accent);
  font-weight: 700;
}

.table-wrap {
  overflow-x: auto;
}

.orders {
  width: 100%;
  border-collapse: collapse;

  th,
  td {
    padding: 0.65rem 0.6rem;
    text-align: left;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  th {
    font-size: 0.8rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--c-text-muted);
  }

  .num {
    text-align: right;
    white-space: nowrap;
  }

  .name {
    overflow-wrap: anywhere;
  }

  .name-text {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .order-hint {
    color: var(--c-accent);
  }

  .date {
    color: var(--c-text-muted);
    white-space: nowrap;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    border-bottom: 0;
  }
}

.qty-input {
  width: 5.5rem;
  min-height: 40px;
  padding: 0.4rem 0.6rem;
  text-align: right;
}

.btn-small {
  min-height: 40px;
  padding: 0.5rem 0.85rem;
  font-size: 0.9rem;
}

.btn-danger {
  border-color: rgba(255, 138, 138, 0.5);
  color: #ff8a8a;
}

.total {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
  font-size: 1.1rem;

  strong {
    color: var(--c-accent);
  }
}

/* 📱 MOBILE: jede Bestellung als kleine Karte statt Tabellenzeile */
@media (max-width: 600px) {
  .orders {
    thead {
      display: none;
    }

    tr,
    td {
      display: block;
    }

    tr {
      padding: 0.6rem 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    td {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      padding: 0.2rem 0;
      border: 0;
      text-align: right;

      &::before {
        content: attr(data-label);
        color: var(--c-text-muted);
        text-align: left;
      }
    }

    .name {
      font-weight: 700;

      .name-text {
        align-items: flex-end;
      }
    }

    .actions {
      padding-top: 0.5rem;

      &::before {
        content: none;
      }

      .btn {
        flex: 1 1 auto;
      }
    }
  }
}
</style>
