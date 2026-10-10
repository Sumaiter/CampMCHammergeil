<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api, ApiError } from '@/api/client'
import type { ShopOrder } from '@/api/types'
import { RoutePath } from '@/router/routePath'
import { formatPrice } from './price'

const orders = ref<ShopOrder[]>([])
const loading = ref(true)
const loadError = ref('')

const dateFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' })
// Der Server liefert UTC im Format "YYYY-MM-DD HH:MM:SS"
const formatDate = (value: string) => dateFormat.format(new Date(value.replace(' ', 'T') + 'Z'))

const lineTotal = (order: ShopOrder): number | null =>
  order.priceCents === null ? null : order.priceCents * order.quantity

const formatLineTotal = (order: ShopOrder) => {
  const total = lineTotal(order)
  return total === null ? '–' : formatPrice(total)
}

const totalCents = computed(() =>
  orders.value.reduce((sum, order) => sum + (lineTotal(order) ?? 0), 0),
)
const hasUnpriced = computed(() => orders.value.some((order) => order.priceCents === null))

async function loadOrders() {
  try {
    const data = await api.get<{ orders: ShopOrder[] }>('/api/shop/orders')
    orders.value = data.orders
    loadError.value = ''
  } catch (err) {
    loadError.value =
      err instanceof ApiError ? err.message : 'Bestellungen konnten nicht geladen werden'
  } finally {
    loading.value = false
  }
}

onMounted(loadOrders)
</script>

<template>
  <div class="page-section shopping-list">
    <h1 class="page-title">Aktuelle Liste</h1>

    <section class="card glass-card">
      <p v-if="loadError" class="form-error" role="alert">{{ loadError }}</p>

      <p v-else-if="!loading && orders.length === 0" class="empty">
        Du hast noch nichts bestellt.
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
              </tr>
            </thead>
            <tbody>
              <tr v-for="order in orders" :key="order.id">
                <td data-label="Artikel" class="name">{{ order.itemName }}</td>
                <td data-label="Anzahl" class="num">{{ order.quantity }}</td>
                <td data-label="Einzelpreis" class="num">{{ formatPrice(order.priceCents) }}</td>
                <td data-label="Summe" class="num">{{ formatLineTotal(order) }}</td>
                <td data-label="Zeitpunkt" class="date">{{ formatDate(order.createdAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p class="total">
          <span>Gesamtsumme</span>
          <strong>{{ formatPrice(totalCents) }}</strong>
        </p>
        <p v-if="hasUnpriced" class="hint">
          Artikel ohne Preis sind in der Gesamtsumme nicht enthalten.
        </p>
      </template>
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

  .date {
    color: var(--c-text-muted);
    white-space: nowrap;
  }
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
    }
  }
}
</style>
