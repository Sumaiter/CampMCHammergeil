<script setup lang="ts">
// Summe pro Artikel über alle Personen - entspricht dem, was im PDF steht.
import { computed } from 'vue'
import type { ShopOrder } from '@/api/types'
import { grandTotal, totalsPerItem } from './orders'
import { formatPrice, formatPriceOrDash as money } from './price'

const props = defineProps<{ orders: ShopOrder[] }>()

const items = computed(() => totalsPerItem(props.orders))
const total = computed(() => grandTotal(props.orders))
</script>

<template>
  <div class="item-totals">
    <h3>Gesamt pro Artikel</h3>

    <div class="shop-table-wrap">
      <table class="shop-table">
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

    <p class="shop-total">
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

.shop-total {
  padding-top: 0.75rem;
  border-top: 1px solid var(--c-border-strong);
}

/* 📱 MOBILE: Zellen oben ausrichten (kein vertikales Zentrieren wie in den Bestelltabellen) */
@media (max-width: 600px) {
  .shop-table td {
    align-items: normal;
  }
}
</style>
