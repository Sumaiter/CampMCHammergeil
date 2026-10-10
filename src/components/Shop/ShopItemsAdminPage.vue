<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api, errorMessage } from '@/api/client'
import type { ShopItem } from '@/api/types'
import { centsToInput, parsePrice } from './price'

const items = ref<ShopItem[]>([])
const loading = ref(true)
const listError = ref('')

// Formular "Neuen Artikel hinzufügen"
const newName = ref('')
const newPrice = ref('')
const createError = ref('')
const createSuccess = ref('')
const creating = ref(false)

// Alle Zeilen sind direkt editierbar; Entwürfe pro Artikel-ID, gespeichert wird gesammelt.
type Draft = { name: string; price: string }
const drafts = ref<Record<number, Draft>>({})
const rowErrors = ref<Record<number, string>>({})
const saveError = ref('')
const saveSuccess = ref('')
const saving = ref(false)

const toDraft = (item: ShopItem): Draft => ({
  name: item.name,
  price: centsToInput(item.priceCents),
})

function resetDrafts(list: ShopItem[]) {
  drafts.value = Object.fromEntries(list.map((item) => [item.id, toDraft(item)]))
}

function isChanged(item: ShopItem): boolean {
  const draft = drafts.value[item.id]
  if (!draft) return false
  const price = parsePrice(draft.price)
  return draft.name.trim() !== item.name || !price.ok || price.cents !== item.priceCents
}

const changedItems = computed(() => items.value.filter(isChanged))

async function saveAll() {
  saveError.value = ''
  saveSuccess.value = ''
  rowErrors.value = {}

  const updates: { item: ShopItem; name: string; priceCents: number | null }[] = []
  for (const item of changedItems.value) {
    const draft = drafts.value[item.id]!
    const price = parsePrice(draft.price)
    if (!price.ok) rowErrors.value[item.id] = 'Ungültiger Preis, z. B. 1,50'
    else if (!draft.name.trim()) rowErrors.value[item.id] = 'Name fehlt'
    else updates.push({ item, name: draft.name.trim(), priceCents: price.cents })
  }
  if (Object.keys(rowErrors.value).length > 0) {
    saveError.value = 'Bitte die markierten Zeilen korrigieren.'
    return
  }

  saving.value = true
  const results = await Promise.allSettled(
    updates.map(({ item, name, priceCents }) =>
      api.put<{ item: ShopItem }>(`/api/shop/items/${item.id}`, { name, priceCents }),
    ),
  )
  saving.value = false

  const saved = new Map<number, ShopItem>()
  results.forEach((result, index) => {
    const id = updates[index]!.item.id
    if (result.status === 'fulfilled') saved.set(id, result.value.item)
    else rowErrors.value[id] = errorMessage(result.reason, 'Konnte nicht gespeichert werden')
  })
  items.value = sortItems(items.value.map((entry) => saved.get(entry.id) ?? entry))
  for (const item of saved.values()) drafts.value[item.id] = toDraft(item)

  if (saved.size < updates.length) saveError.value = 'Nicht alle Änderungen wurden gespeichert.'
  else saveSuccess.value = `${saved.size} Artikel gespeichert.`
}

const sortItems = (list: ShopItem[]) =>
  [...list].sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }))

async function loadItems() {
  try {
    const data = await api.get<{ items: ShopItem[] }>('/api/shop/items')
    items.value = sortItems(data.items)
    resetDrafts(items.value)
    listError.value = ''
  } catch (err) {
    listError.value = errorMessage(err, 'Artikel konnten nicht geladen werden')
  } finally {
    loading.value = false
  }
}

async function createItem() {
  createError.value = ''
  createSuccess.value = ''
  const price = parsePrice(newPrice.value)
  if (!price.ok) {
    createError.value = 'Bitte einen gültigen Preis eingeben, z. B. 1,50'
    return
  }
  creating.value = true
  try {
    const data = await api.post<{ item: ShopItem }>('/api/shop/items', {
      name: newName.value.trim(),
      priceCents: price.cents,
    })
    items.value = sortItems([...items.value, data.item])
    drafts.value[data.item.id] = toDraft(data.item)
    createSuccess.value = `Artikel „${data.item.name}“ hinzugefügt.`
    newName.value = ''
    newPrice.value = ''
  } catch (err) {
    createError.value = errorMessage(err, 'Artikel konnte nicht hinzugefügt werden')
  } finally {
    creating.value = false
  }
}

onMounted(loadItems)
</script>

<template>
  <div class="page-section shop-admin">
    <h1 class="page-title">Shopliste</h1>

    <form class="shop-card glass-card" @submit.prevent="createItem">
      <h2>Neuen Artikel hinzufügen</h2>

      <div class="create-fields">
        <label class="form-field">
          <span>Name</span>
          <input v-model="newName" class="form-input" autocomplete="off" maxlength="100" required />
        </label>

        <label class="form-field">
          <span>Preis in € (optional)</span>
          <input
            v-model="newPrice"
            class="form-input"
            inputmode="decimal"
            autocomplete="off"
            placeholder="z. B. 1,50"
          />
        </label>
      </div>

      <p v-if="createError" class="form-error" role="alert">{{ createError }}</p>
      <p v-if="createSuccess" class="form-success" role="status">{{ createSuccess }}</p>

      <button type="submit" class="btn" :disabled="creating">Hinzufügen</button>
    </form>

    <section class="shop-card glass-card">
      <h2>Artikel</h2>

      <p v-if="listError" class="form-error" role="alert">{{ listError }}</p>
      <p v-else-if="!loading && items.length === 0" class="empty">Noch keine Artikel angelegt.</p>

      <form v-if="items.length > 0" @submit.prevent="saveAll">
        <ul class="shop-plain-list">
          <li
            v-for="item in items"
            :key="item.id"
            class="item-row"
            :class="{ changed: isChanged(item) }"
          >
            <template v-if="drafts[item.id]">
              <input
                v-model="drafts[item.id]!.name"
                class="form-input"
                autocomplete="off"
                maxlength="100"
                :aria-label="`Name von ${item.name}`"
              />
              <div class="price-field">
                <input
                  v-model="drafts[item.id]!.price"
                  class="form-input"
                  inputmode="decimal"
                  autocomplete="off"
                  placeholder="kein Preis"
                  :aria-label="`Preis von ${item.name} in Euro`"
                />
                <span aria-hidden="true">€</span>
              </div>
            </template>
            <p v-if="rowErrors[item.id]" class="form-error row-error" role="alert">
              {{ rowErrors[item.id] }}
            </p>
          </li>
        </ul>

        <p v-if="saveError" class="form-error" role="alert">{{ saveError }}</p>
        <p v-if="saveSuccess" class="form-success" role="status">{{ saveSuccess }}</p>

        <button type="submit" class="btn save-all" :disabled="saving || changedItems.length === 0">
          Speichern{{ changedItems.length > 0 ? ` (${changedItems.length})` : '' }}
        </button>
      </form>
    </section>
  </div>
</template>

<style scoped lang="scss">
.shop-admin {
  max-width: 720px;
}

.shop-card {
  & + & {
    margin-top: 1.25rem;
  }

  h2 {
    font-size: 1.15rem;
    color: var(--c-accent);
  }
}

.create-fields {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 1rem;
}

.empty {
  color: var(--c-text-muted);
}

.item-row {
  display: grid;
  grid-template-columns: 2fr 1fr;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0;

  & + & {
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  &.changed .form-input {
    border-color: var(--c-accent);
  }
}

.price-field {
  display: flex;
  align-items: center;
  gap: 0.4rem;

  .form-input {
    text-align: right;
  }
}

.row-error {
  grid-column: 1 / -1;
  margin: 0;
}

.save-all {
  margin-top: 0.75rem;
}

/* 📱 MOBILE: Felder untereinander */
@media (max-width: 600px) {
  .create-fields {
    grid-template-columns: 1fr;
  }

  .item-row {
    grid-template-columns: 1fr 7rem;
  }
}
</style>
