<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { api, errorMessage } from '@/api/client'
import type { ShopBalance, ShopOrder } from '@/api/types'
import { useAuth } from '@/auth/useAuth'
import { RoutePath } from '@/router/routePath'
import { formatDateTime, formatListTitle } from './date'
import { formatLineTotal, groupByList, orderHint, ownTotal } from './orders'
import { formatPrice, paypalPayUrl } from './price'
import QuantityStepper from './QuantityStepper.vue'
import { useOrderEdit } from './useOrderEdit'
import { useShopUsers } from './useShopUsers'

const { isAdmin } = useAuth()
const { meId, users, usersError, loadUsers, userOptions } = useShopUsers()

const orders = ref<ShopOrder[]>([])
const loading = ref(true)
const loadError = ref('')

// Admin: Benutzer, dessen Übersicht angezeigt wird (vorbelegt mit mir selbst)
const viewedId = ref<number | null>(null)
const viewed = computed(() => viewedId.value ?? meId.value)

// Admin: "Wer muss was zahlen?"
const showBalances = ref(false)
const balances = ref<ShopBalance[]>([])
const balancesLoading = ref(false)
const balancesError = ref('')

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
    loadError.value = errorMessage(err, 'Übersicht konnte nicht geladen werden')
  } finally {
    if (token === loadToken) loading.value = false
  }
}

// Admin: gedruckte Positionen ändern/löschen, danach Übersicht (und Beträge) neu laden
async function reloadAfterEdit() {
  await loadOverview()
  if (showBalances.value) await loadBalances()
}

// Nach dem Sammel-Speichern wird einmal neu geladen (siehe saveAll), nicht pro Position
const { actionError, busyId, saving, drafts, syncDrafts, isChanged, saveChanged, remove } =
  useOrderEdit({
    basePath: '/api/shop/printed-orders',
    onSaved: () => {},
    onRemoved: reloadAfterEdit,
    onStale: reloadAfterEdit,
  })
watch(orders, syncDrafts, { immediate: true })

function draftOf(order: ShopOrder): number {
  return Number(drafts.value[order.id] ?? order.quantity)
}

const hasChanges = computed(() => orders.value.some(isChanged))
const saveSuccess = ref(false)

async function saveAll() {
  saveSuccess.value = false
  saveSuccess.value = await saveChanged(orders.value)
  await reloadAfterEdit()
}

async function loadBalances() {
  balancesLoading.value = true
  try {
    const data = await api.get<{ balances: ShopBalance[] }>('/api/shop/balances')
    balances.value = data.balances
    balancesError.value = ''
  } catch (err) {
    balancesError.value = errorMessage(err, 'Beträge konnten nicht geladen werden')
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

    <section v-if="isAdmin" class="shop-card glass-card">
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
        <div v-else class="shop-table-wrap">
          <table class="shop-table balances">
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

    <section v-else-if="!loading && groups.length === 0" class="shop-card glass-card">
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
      <section class="shop-card glass-card">
        <p class="shop-total">
          <span>{{ viewingOther ? `Gesamtsumme für ${viewedName}` : 'Deine Gesamtsumme' }}</span>
          <strong>{{ formatPrice(grand.totalCents) }}</strong>
        </p>
        <a
          v-if="!viewingOther && grand.totalCents > 0"
          class="btn paypal-link"
          :href="paypalPayUrl(grand.totalCents)"
          target="_blank"
          rel="noopener"
        >
          Mit PayPal bezahlen
        </a>
        <p class="hint">
          Bestellungen für andere sind in der Summe nicht enthalten, ebenso Artikel ohne Preis{{
            unpricedText
          }}.
        </p>
      </section>

      <section v-for="group in groups" :key="group.listId" class="shop-card glass-card">
        <h2 class="list-title">{{ formatListTitle(group.printedAt) }}</h2>

        <div class="shop-table-wrap">
          <table class="shop-table">
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
                  <QuantityStepper
                    v-if="isAdmin"
                    :model-value="draftOf(order)"
                    :min="1"
                    :max="999"
                    :label="`Anzahl für ${order.itemName}`"
                    :disabled="busyId === order.id || saving"
                    @update:model-value="drafts[order.id] = $event"
                  />
                  <template v-else>{{ order.quantity }}</template>
                </td>
                <td data-label="Einzelpreis" class="num">{{ formatPrice(order.priceCents) }}</td>
                <td data-label="Summe" class="num">{{ formatLineTotal(order) }}</td>
                <td data-label="Bestellt" class="date">{{ formatDateTime(order.createdAt) }}</td>
                <td v-if="isAdmin" class="actions">
                  <button
                    type="button"
                    class="btn btn-secondary btn-small btn-danger"
                    :disabled="busyId === order.id || saving"
                    @click="remove(order)"
                  >
                    Löschen
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p class="shop-total">
          <span>Summe dieser Liste</span>
          <strong>{{ formatPrice(ownTotal(group.orders, viewed).totalCents) }}</strong>
        </p>
      </section>

      <!-- Admin: ein Speichern-Button für alle Listen; bei offenen Änderungen beim Scrollen sichtbar -->
      <section
        v-if="isAdmin"
        class="shop-card glass-card save-bar"
        :class="{ pending: hasChanges || saving }"
      >
        <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
        <p v-if="saveSuccess && !hasChanges" class="form-success" role="status">
          Änderungen gespeichert.
        </p>
        <button type="button" class="btn" :disabled="!hasChanges || saving" @click="saveAll">
          Speichern
        </button>
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

.balances .order-hint {
  display: block;
  color: var(--c-text-muted);
  white-space: normal;
}

.btn-small {
  align-self: flex-start;
}

.save-bar {
  .btn {
    align-self: flex-start;
  }

  &.pending {
    position: sticky;
    bottom: 1rem;
    z-index: 1;
  }
}

.paypal-link {
  align-self: flex-start;
  text-decoration: none;
}
</style>
