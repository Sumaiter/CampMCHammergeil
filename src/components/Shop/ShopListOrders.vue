<script setup lang="ts">
import { computed, watch } from 'vue'
import type { ShopOrder } from '@/api/types'
import { formatLineTotal, grandTotal, groupByRecipient, orderedByHint } from './orders'
import { formatPrice, formatPriceOrDash } from './price'
import { useOrderEdit } from './useOrderEdit'

// editable: Admin kann gedruckte Positionen ändern/löschen ("changed" -> Elternseite lädt neu)
const props = defineProps<{ orders: ShopOrder[]; editable?: boolean }>()
const emit = defineEmits<{ changed: [] }>()

const { actionError, busyId, drafts, syncDrafts, isChanged, save, remove } = useOrderEdit({
  basePath: '/api/shop/printed-orders',
  onSaved: () => emit('changed'),
  onRemoved: () => emit('changed'),
  onStale: () => emit('changed'),
})
watch(() => props.orders, syncDrafts, { immediate: true })

const groups = computed(() => groupByRecipient(props.orders))
const total = computed(() => grandTotal(props.orders))
</script>

<template>
  <div class="list-orders">
    <section v-for="group in groups" :key="group.userId" class="person">
      <h3>{{ group.username }}</h3>

      <div class="shop-table-wrap">
        <table class="shop-table">
          <thead>
            <tr>
              <th>Artikel</th>
              <th class="num">Menge</th>
              <th class="num">Preis</th>
              <th class="num">Summe</th>
              <th v-if="editable"><span class="sr-only">Aktionen</span></th>
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
              <td data-label="Menge" class="num">
                <input
                  v-if="editable"
                  v-model="drafts[order.id]"
                  class="form-input shop-qty-input"
                  type="number"
                  inputmode="numeric"
                  min="1"
                  max="999"
                  step="1"
                  :aria-label="`Menge für ${order.itemName}`"
                  :disabled="busyId === order.id"
                />
                <template v-else>{{ order.quantity }}</template>
              </td>
              <td data-label="Preis" class="num">{{ formatPriceOrDash(order.priceCents) }}</td>
              <td data-label="Summe" class="num">{{ formatLineTotal(order) }}</td>
              <td v-if="editable" class="actions">
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

      <p class="subtotal">
        <span>
          Summe {{ group.username }}
          <small v-if="group.unpricedCount > 0">({{ group.unpricedCount }} ohne Preis)</small>
        </span>
        <strong>{{ formatPrice(group.totalCents) }}</strong>
      </p>
    </section>

    <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>

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

.subtotal {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
  padding: 0 0.6rem;

  small {
    color: var(--c-text-muted);
  }
}

.shop-total {
  padding-top: 0.75rem;
  border-top: 1px solid var(--c-border-strong);
}

/* 📱 MOBILE */
@media (max-width: 600px) {
  .subtotal {
    padding: 0;
  }
}
</style>
