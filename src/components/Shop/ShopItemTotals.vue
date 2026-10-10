<script setup lang="ts">
// Summe pro Artikel über alle Personen - entspricht dem, was im PDF steht.
import { computed } from 'vue'
import type { ShopOrder } from '@/api/types'
import { grandTotal, totalsPerItem } from './listData'
import { formatPrice } from './price'

const props = defineProps<{ orders: ShopOrder[] }>()

const items = computed(() => totalsPerItem(props.orders))
const total = computed(() => grandTotal(props.orders))

const money = (cents: number | null) => (cents === null ? '–' : formatPrice(cents))
</script>

<template>
  <div class="item-totals">
    <h3>Gesamt pro Artikel</h3>

    <div class="table-wrap">
      <table class="orders">
        <thead>
          <tr>
            <th>Artikel</th>
            <th class="num">Menge</th>
            <th class="num">Einzelpreis</th>
            <th class="num">Summe</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="`${item.itemId}:${item.priceCents}`">
            <td data-label="Artikel" class="name">{{ item.itemName }}</td>
            <td data-label="Menge" class="num">{{ item.quantity }}</td>
            <td data-label="Einzelpreis" class="num">{{ money(item.priceCents) }}</td>
            <td data-label="Summe" class="num">{{ money(item.totalCents) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

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
.item-totals {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;

  h3 {
    font-size: 1.05rem;
    color: var(--c-accent);
  }
}

.hint {
  color: var(--c-text-muted);
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

.total {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
  font-size: 1.1rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--c-border-strong);

  strong {
    color: var(--c-accent);
  }
}

/* 📱 MOBILE: jede Position als kleine Karte statt Tabellenzeile */
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
