<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api, ApiError } from '@/api/client'
import type { ShopListDetail, ShopOrder } from '@/api/types'
import { shopListDetailPath } from '@/router/routePath'
import ShopItemTotals from './ShopItemTotals.vue'
import { downloadListPdf } from './pdf'

const orders = ref<ShopOrder[]>([])
const loading = ref(true)
const loadError = ref('')

const printing = ref(false)
const printError = ref('')
const printedList = ref<ShopListDetail | null>(null)

const errorText = (err: unknown, fallback: string) =>
  err instanceof ApiError ? err.message : fallback

const empty = computed(() => !loading.value && !loadError.value && orders.value.length === 0)

async function loadOrders() {
  try {
    const data = await api.get<{ orders: ShopOrder[] }>('/api/shop/open-orders')
    orders.value = data.orders
    loadError.value = ''
  } catch (err) {
    loadError.value = errorText(err, 'Offene Bestellungen konnten nicht geladen werden')
  } finally {
    loading.value = false
  }
}

async function printList() {
  if (!confirm('Liste jetzt drucken? Danach können die Bestellungen nicht mehr geändert werden.')) {
    return
  }
  printError.value = ''
  printedList.value = null
  printing.value = true
  try {
    const data = await api.post<{ list: ShopListDetail }>('/api/shop/lists', {})
    printedList.value = data.list
    // Ab hier ist die Liste angelegt - ein Fehler kann nur noch das PDF betreffen.
    try {
      await downloadListPdf(data.list)
    } catch {
      printError.value =
        'Die Liste wurde gedruckt, das PDF konnte aber nicht erstellt werden. Du kannst es in der Detailansicht erneut herunterladen.'
    }
  } catch (err) {
    printError.value = errorText(err, 'Liste konnte nicht gedruckt werden')
  } finally {
    printing.value = false
    await loadOrders()
  }
}

onMounted(loadOrders)
</script>

<template>
  <div class="page-section shop-print">
    <h1 class="page-title">Liste drucken</h1>

    <section class="card glass-card">
      <p v-if="loadError" class="form-error" role="alert">{{ loadError }}</p>
      <p v-else-if="empty" class="empty">Keine offenen Bestellungen.</p>

      <ShopItemTotals v-if="orders.length > 0" :orders="orders" />

      <p v-if="printError" class="form-error" role="alert">{{ printError }}</p>
      <p v-if="printedList" class="form-success" role="status">
        Liste #{{ printedList.id }} wurde gedruckt.
        <router-link :to="shopListDetailPath(printedList.id)">Zur Liste</router-link>
      </p>

      <button
        type="button"
        class="btn"
        :disabled="printing || loading || orders.length === 0"
        @click="printList"
      >
        Liste drucken
      </button>
    </section>
  </div>
</template>

<style scoped lang="scss">
.shop-print {
  max-width: 900px;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: clamp(1.25rem, 5vw, 2rem);
}

.empty {
  color: var(--c-text-muted);
}

.form-success a {
  color: var(--c-accent);
  font-weight: 700;
}
</style>
