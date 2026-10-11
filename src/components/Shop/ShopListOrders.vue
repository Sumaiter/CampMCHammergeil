<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ShopOrder } from '@/api/types'
import { formatLineTotal, grandTotal, groupByRecipient, orderedByHint } from './orders'
import { formatPrice, formatPriceOrDash } from './price'
import QuantityStepper from './QuantityStepper.vue'
import { useOrderEdit } from './useOrderEdit'

// editable: Admin kann gedruckte Positionen ändern/löschen ("changed" -> Elternseite lädt neu)
const props = defineProps<{ orders: ShopOrder[]; editable?: boolean }>()
const emit = defineEmits<{ changed: [] }>()

// Nach dem Sammel-Speichern wird einmal neu geladen (siehe saveAll), nicht pro Position
const { actionError, busyId, saving, drafts, syncDrafts, isChanged, saveChanged, remove } =
  useOrderEdit({
    basePath: '/api/shop/printed-orders',
    onSaved: () => {},
    onRemoved: () => emit('changed'),
    onStale: () => emit('changed'),
  })
watch(() => props.orders, syncDrafts, { immediate: true })

function draftOf(order: ShopOrder): number {
  return Number(drafts.value[order.id] ?? order.quantity)
}

const hasChanges = computed(() => props.orders.some(isChanged))
const saveSuccess = ref(false)

async function saveAll() {
  saveSuccess.value = false
  saveSuccess.value = await saveChanged(props.orders)
  emit('changed')
}

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
                <QuantityStepper
                  v-if="editable"
                  :model-value="draftOf(order)"
                  :min="1"
                  :max="999"
                  :label="`Menge für ${order.itemName}`"
                  :disabled="busyId === order.id || saving"
                  @update:model-value="drafts[order.id] = $event"
                />
                <template v-else>{{ order.quantity }}</template>
              </td>
              <td data-label="Preis" class="num">{{ formatPriceOrDash(order.priceCents) }}</td>
              <td data-label="Summe" class="num">{{ formatLineTotal(order) }}</td>
              <td v-if="editable" class="actions">
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

      <p class="subtotal">
        <span>
          Summe {{ group.username }}
          <small v-if="group.unpricedCount > 0">({{ group.unpricedCount }} ohne Preis)</small>
        </span>
        <strong>{{ formatPrice(group.totalCents) }}</strong>
      </p>
    </section>

    <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
    <p v-if="saveSuccess && !hasChanges" class="form-success" role="status">
      Änderungen gespeichert.
    </p>

    <div v-if="editable">
      <button type="button" class="btn" :disabled="!hasChanges || saving" @click="saveAll">
        Speichern
      </button>
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
