<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api, errorMessage } from '@/api/client'
import type { ShopList } from '@/api/types'
import { shopListDetailPath } from '@/router/routePath'
import { formatDateTime } from './date'
import { formatPrice } from './price'

const lists = ref<ShopList[]>([])
const loading = ref(true)
const loadError = ref('')

async function loadLists() {
  try {
    const data = await api.get<{ lists: ShopList[] }>('/api/shop/lists')
    lists.value = data.lists
    loadError.value = ''
  } catch (err) {
    loadError.value = errorMessage(err, 'Listen konnten nicht geladen werden')
  } finally {
    loading.value = false
  }
}

onMounted(loadLists)
</script>

<template>
  <div class="page-section shop-lists">
    <h1 class="page-title">Alte Listen</h1>

    <section class="shop-card glass-card">
      <p v-if="loadError" class="form-error" role="alert">{{ loadError }}</p>
      <p v-else-if="!loading && lists.length === 0" class="empty">Noch keine Liste gedruckt.</p>

      <ul class="shop-plain-list">
        <li v-for="list in lists" :key="list.id">
          <router-link :to="shopListDetailPath(list.id)" class="list-row">
            <div class="shop-item-info">
              <strong class="list-title">
                Liste #{{ list.id }} – {{ formatDateTime(list.printedAt) }} Uhr
              </strong>
              <small>
                <template v-if="list.printedByName">
                  gedruckt von {{ list.printedByName }} ·
                </template>
                {{ list.orderCount }} {{ list.orderCount === 1 ? 'Position' : 'Positionen' }}
              </small>
            </div>
            <div class="list-sum">
              <strong>{{ formatPrice(list.totalCents) }}</strong>
              <small v-if="list.unpricedCount > 0">+ {{ list.unpricedCount }} ohne Preis</small>
            </div>
          </router-link>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped lang="scss">
.shop-lists {
  max-width: 720px;
}

.empty {
  color: var(--c-text-muted);
}

.shop-plain-list li + li {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.list-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.9rem 0;
  color: inherit;
  text-decoration: none;

  &:hover .list-title {
    color: var(--c-accent);
  }
}

.list-sum {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
  align-items: flex-end;
  text-align: right;

  small {
    color: var(--c-text-muted);
  }

  strong {
    color: var(--c-accent);
  }
}

/* 📱 MOBILE: Summe unter die Listeninfo */
@media (max-width: 600px) {
  .list-row {
    grid-template-columns: 1fr;
  }

  .list-sum {
    align-items: flex-start;
    text-align: left;
  }
}
</style>
