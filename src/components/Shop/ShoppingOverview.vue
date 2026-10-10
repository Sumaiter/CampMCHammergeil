<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { api, ApiError } from '@/api/client'
import type { ShopBalance, ShopOrder, ShopUser } from '@/api/types'
import { useAuth } from '@/auth/useAuth'
import { RoutePath } from '@/router/routePath'
import { formatPrice } from './price'
import { useOrderEdit } from './useOrderEdit'
import {
  formatDateTime,
  formatLineTotal,
  formatListTitle,
  groupByList,
  orderHint,
  ownTotal,
} from './user-orders'

const { user, isAdmin } = useAuth()
const meId = computed(() => user.value?.id ?? 0)

const orders = ref<ShopOrder[]>([])
const loading = ref(true)
const loadError = ref('')

// Admin: Benutzer, dessen Übersicht angezeigt wird (vorbelegt mit mir selbst)
const users = ref<ShopUser[]>([])
const usersError = ref('')
const viewedId = ref<number | null>(null)
const viewed = computed(() => viewedId.value ?? meId.value)

// Admin: "Wer muss was zahlen?"
const showBalances = ref(false)
const balances = ref<ShopBalance[]>([])
const balancesLoading = ref(false)
const balancesError = ref('')

const errorText = (err: unknown, fallback: string) =>
  err instanceof ApiError ? err.message : fallback

const groups = computed(() => groupByList(orders.value))
const grand = computed(() => ownTotal(orders.value, viewed.value))
const viewingOther = computed(() => viewed.value !== meId.value)
const viewedName = computed(
  () => users.value.find((entry) => entry.id === viewed.value)?.username ?? '',
)

// Nur die jeweils letzte Anfrage darf das Ergebnis setzen (schneller Benutzerwechsel)
let loadToken = 0

async function loadOverview() {
  const token = ++loadToken
  const query = viewingOther.value ? `?userId=${viewed.value}` : ''
  try {
    const data = await api.get<{ orders: ShopOrder[] }>(`/api/shop/overview${query}`)
    if (token !== loadToken) return
    orders.value = data.orders
    loadError.value = ''
  } catch (err) {
    if (token !== loadToken) return
    orders.value = []
    loadError.value = errorText(err, 'Übersicht konnte nicht geladen werden')
  } finally {
    if (token === loadToken) loading.value = false
  }
}

// Admin: gedruckte Positionen ändern/löschen, danach Übersicht (und Beträge) neu laden
async function reloadAfterEdit() {
  await loadOverview()
  if (showBalances.value) await loadBalances()
}

const { actionError, busyId, drafts, syncDrafts, isChanged, save, remove } = useOrderEdit({
  basePath: '/api/shop/printed-orders',
  onSaved: reloadAfterEdit,
  onRemoved: reloadAfterEdit,
  onStale: reloadAfterEdit,
})
watch(orders, syncDrafts, { immediate: true })

async function loadUsers() {
  try {
    const data = await api.get<{ users: ShopUser[] }>('/api/shop/users')
    users.value = data.users
    usersError.value = ''
  } catch (err) {
    usersError.value = errorText(err, 'Benutzer konnten nicht geladen werden')
  }
}

const userOptions = computed(() => {
  const me = users.value.find((entry) => entry.id === meId.value)
  const others = users.value.filter((entry) => entry.id !== meId.value)
  return [
    { id: meId.value, label: `Mich selbst (${me?.username ?? user.value?.username ?? ''})` },
    ...others.map((entry) => ({ id: entry.id, label: entry.username })),
  ]
})

async function loadBalances() {
  balancesLoading.value = true
  try {
    const data = await api.get<{ balances: ShopBalance[] }>('/api/shop/balances')
    balances.value = data.balances
    balancesError.value = ''
  } catch (err) {
    balancesError.value = errorText(err, 'Beträge konnten nicht geladen werden')
  } finally {
    balancesLoading.value = false
  }
}

async function toggleBalances() {
  showBalances.value = !showBalances.value
  if (showBalances.value) await loadBalances()
}

watch(viewedId, (value, previous) => {
  if (previous === null) return // Vorbelegung beim Start, kein Wechsel
  loading.value = true
  void loadOverview()
})

const unpricedText = computed(() => {
  const count = grand.value.unpricedCount
  if (count === 0) return ''
  return ` (${count} ${count === 1 ? 'Position' : 'Positionen'} ohne Preis)`
})

onMounted(() => {
  viewedId.value = meId.value
  void loadOverview()
  if (isAdmin.value) void loadUsers()
})
</script>

<template>
  <div class="page-section overview">
    <h1 class="page-title">Übersicht</h1>

    <section v-if="isAdmin" class="card glass-card">
      <label v-if="users.length > 0" class="form-field">
        <span>Übersicht anzeigen für</span>
        <select v-model="viewedId" class="form-input">
          <option v-for="option in userOptions" :key="option.id" :value="option.id">
            {{ option.label }}
          </option>
        </select>
      </label>
      <p v-else-if="usersError" class="form-error" role="alert">{{ usersError }}</p>

      <div>
        <button
          type="button"
          class="btn btn-secondary btn-small"
          :aria-expanded="showBalances"
          @click="toggleBalances"
        >
          {{ showBalances ? 'Ausblenden' : 'Wer muss was zahlen?' }}
        </button>
      </div>

      <template v-if="showBalances">
        <p v-if="balancesError" class="form-error" role="alert">{{ balancesError }}</p>
        <p v-else-if="balancesLoading" class="empty">Lädt …</p>
        <p v-else-if="balances.length === 0" class="empty">Es gibt noch keine gedruckten Listen.</p>
        <div v-else class="table-wrap">
          <table class="orders balances">
            <thead>
              <tr>
                <th>Benutzer</th>
                <th class="num">Betrag</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="balance in balances" :key="balance.userId">
                <td data-label="Benutzer" class="name">{{ balance.username }}</td>
                <td data-label="Betrag" class="num">
                  {{ formatPrice(balance.totalCents) }}
                  <small v-if="balance.unpricedCount > 0" class="order-hint">
                    ({{ balance.unpricedCount }} Artikel ohne Preis nicht enthalten)
                  </small>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </section>

    <p v-if="loadError" class="form-error" role="alert">{{ loadError }}</p>

    <section v-else-if="!loading && groups.length === 0" class="card glass-card">
      <p class="empty">
        <template v-if="viewingOther">
          Für {{ viewedName || 'diesen Benutzer' }} gibt es noch keine gedruckten Bestellungen.
        </template>
        <template v-else>
          Es gibt noch keine gedruckten Bestellungen von dir.
          <router-link :to="RoutePath.ShoppingList">Zur aktuellen Liste</router-link>
        </template>
      </p>
    </section>

    <template v-if="groups.length > 0">
      <section class="card glass-card">
        <p class="total">
          <span>{{ viewingOther ? `Gesamtsumme für ${viewedName}` : 'Deine Gesamtsumme' }}</span>
          <strong>{{ formatPrice(grand.totalCents) }}</strong>
        </p>
        <p class="hint">
          Bestellungen für andere sind in der Summe nicht enthalten, ebenso Artikel ohne Preis{{
            unpricedText
          }}.
        </p>
      </section>

      <section v-for="group in groups" :key="group.listId" class="card glass-card">
        <h2 class="list-title">{{ formatListTitle(group.printedAt) }}</h2>

        <div class="table-wrap">
          <table class="orders">
            <thead>
              <tr>
                <th>Artikel</th>
                <th class="num">Anzahl</th>
                <th class="num">Einzelpreis</th>
                <th class="num">Summe</th>
                <th>Bestellt</th>
                <th v-if="isAdmin"><span class="sr-only">Aktionen</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="order in group.orders" :key="order.id">
                <td data-label="Artikel" class="name">
                  <span class="name-text">
                    {{ order.itemName }}
                    <small v-if="orderHint(order, viewed)" class="order-hint">
                      {{ orderHint(order, viewed) }}
                    </small>
                  </span>
                </td>
                <td data-label="Anzahl" class="num">
                  <input
                    v-if="isAdmin"
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
                  <template v-else>{{ order.quantity }}</template>
                </td>
                <td data-label="Einzelpreis" class="num">{{ formatPrice(order.priceCents) }}</td>
                <td data-label="Summe" class="num">{{ formatLineTotal(order) }}</td>
                <td data-label="Bestellt" class="date">{{ formatDateTime(order.createdAt) }}</td>
                <td v-if="isAdmin" class="actions">
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

        <p v-if="isAdmin && actionError" class="form-error" role="alert">{{ actionError }}</p>

        <p class="total">
          <span>Summe dieser Liste</span>
          <strong>{{ formatPrice(ownTotal(group.orders, viewed).totalCents) }}</strong>
        </p>
      </section>
    </template>
  </div>
</template>

<style scoped lang="scss">
.overview {
  max-width: 900px;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: clamp(1.25rem, 5vw, 2rem);
}

.list-title {
  font-size: 1.15rem;
}

.empty,
.hint {
  color: var(--c-text-muted);
}

.empty a {
  color: var(--c-accent);
  font-weight: 700;
}

select.form-input option {
  background: #111a16;
  color: var(--c-text);
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
  }

  td.num {
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

.btn-danger {
  border-color: rgba(255, 138, 138, 0.5);
  color: #ff8a8a;
}

.order-hint {
  color: var(--c-accent);
}

.balances .order-hint {
  display: block;
  color: var(--c-text-muted);
  white-space: normal;
}

.btn-small {
  align-self: flex-start;
  min-height: 40px;
  padding: 0.5rem 0.85rem;
  font-size: 0.9rem;
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
