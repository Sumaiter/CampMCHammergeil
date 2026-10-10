<script setup lang="ts">
import { computed } from 'vue'
import type { ShopOrder } from '@/api/types'
import { grandTotal, groupByRecipient, lineTotal, orderedByHint } from './listData'
import { formatPrice } from './price'

const props = defineProps<{ orders: ShopOrder[] }>()

const groups = computed(() => groupByRecipient(props.orders))
const total = computed(() => grandTotal(props.orders))

const formatLineTotal = (order: ShopOrder) => {
  const sum = lineTotal(order)
  return sum === null ? '–' : formatPrice(sum)
}
const formatUnit = (order: ShopOrder) =>
  order.priceCents === null ? '–' : formatPrice(order.priceCents)
</script>

<template>
  <div class="list-orders">
    <section v-for="group in groups" :key="group.userId" class="person">
      <h3>{{ group.username }}</h3>

      <div class="table-wrap">
        <table class="orders">
          <thead>
            <tr>
              <th>Artikel</th>
              <th class="num">Menge</th>
              <th class="num">Preis</th>
              <th class="num">Summe</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in group.orders" :key="order.id">
              <td data-label="Artikel" class="name">
                <span>
                  {{ order.itemName }}
                  <small v-if="orderedByHint(order)" class="by">
                    von {{ orderedByHint(order) }}
                  </small>
                </span>
              </td>
              <td data-label="Menge" class="num">{{ order.quantity }}</td>
              <td data-label="Preis" class="num">{{ formatUnit(order) }}</td>
              <td data-label="Summe" class="num">{{ formatLineTotal(order) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="subtotal">
        <span>
          Summe {{ group.username }}
          <small v-if="group.unpricedCount > 0">({{ group.unpricedCount }} ohne Preis)</small>
        </span>
        <strong>{{ formatPrice(group.totalCents) }}</strong>
      </p>
    </section>

    <p class="total">
      <span>Gesamtsumme</span>
      <strong>{{ formatPrice(total.totalCents) }}</strong>
    </p>
    <p v-if="total.unpricedCount > 0" class="hint">
      {{ total.unpricedCount }}
      {{ total.unpricedCount === 1 ? 'Position hat' : 'Positionen haben' }} keinen Preis und
      {{ total.unpricedCount === 1 ? 'ist' : 'sind' }} in der Gesamtsumme nicht enthalten.
    </p>
  </div>
</template>

<style scoped lang="scss">
.list-orders {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.person {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  & + & {
    margin-top: 0.5rem;
  }

  h3 {
    font-size: 1.05rem;
    color: var(--c-accent);
  }
}

.hint,
.by {
  color: var(--c-text-muted);
}

.by {
  display: block;
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
}

.subtotal,
.total {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
}

.subtotal {
  padding: 0 0.6rem;

  small {
    color: var(--c-text-muted);
  }
}

.total {
  font-size: 1.1rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--c-border-strong);

  strong {
    color: var(--c-accent);
  }
}

/* 📱 MOBILE: jede Position als kleine Karte statt Tabellenzeile */
@media (max-width: 600px) {
  .subtotal {
    padding: 0;
  }

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
