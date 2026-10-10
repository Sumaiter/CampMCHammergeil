<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { api, ApiError } from '@/api/client'
import type { ShopListDetail } from '@/api/types'
import { RoutePath } from '@/router/routePath'
import ShopListOrders from './ShopListOrders.vue'
import { formatPrintedDate, formatPrintedTime } from './listData'
import { downloadListPdf } from './pdf'

const route = useRoute()
const id = computed(() => Number(route.params.id))

const list = ref<ShopListDetail | null>(null)
const loading = ref(true)
const loadError = ref('')
const downloading = ref(false)
const pdfError = ref('')

async function loadList() {
  if (!Number.isInteger(id.value) || id.value <= 0) {
    loadError.value = 'Liste nicht gefunden'
    loading.value = false
    return
  }
  try {
    const data = await api.get<{ list: ShopListDetail }>(`/api/shop/lists/${id.value}`)
    list.value = data.list
    loadError.value = ''
  } catch (err) {
    if (err instanceof ApiError) {
      loadError.value = err.status === 404 ? 'Liste nicht gefunden' : err.message
    } else {
      loadError.value = 'Liste konnte nicht geladen werden'
    }
  } finally {
    loading.value = false
  }
}

async function downloadPdf() {
  if (!list.value) return
  pdfError.value = ''
  downloading.value = true
  try {
    await downloadListPdf(list.value)
  } catch {
    pdfError.value = 'PDF konnte nicht erstellt werden'
  } finally {
    downloading.value = false
  }
}

onMounted(loadList)
</script>

<template>
  <div class="page-section shop-list-detail">
    <router-link :to="RoutePath.ShopLists" class="back-link">← Alle Listen</router-link>

    <h1 class="page-title">{{ list ? `Liste #${list.id}` : 'Liste' }}</h1>

    <section class="card glass-card">
      <p v-if="loadError" class="form-error" role="alert">{{ loadError }}</p>

      <template v-if="list">
        <p class="meta">
          Gedruckt am {{ formatPrintedDate(list.printedAt) }},
          {{ formatPrintedTime(list.printedAt) }} Uhr
          <template v-if="list.printedByName"> von {{ list.printedByName }}</template>
        </p>

        <ShopListOrders :orders="list.orders" />

        <p v-if="pdfError" class="form-error" role="alert">{{ pdfError }}</p>
        <button type="button" class="btn" :disabled="downloading" @click="downloadPdf">
          PDF herunterladen
        </button>
      </template>
    </section>
  </div>
</template>

<style scoped lang="scss">
.shop-list-detail {
  max-width: 900px;
}

.back-link {
  display: inline-block;
  margin-bottom: 0.75rem;
  color: var(--c-accent);
  font-weight: 700;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: clamp(1.25rem, 5vw, 2rem);
}

.meta {
  color: var(--c-text-muted);
}
</style>
