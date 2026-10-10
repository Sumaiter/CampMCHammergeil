<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api, ApiError } from '@/api/client'
import type { ShopItem } from '@/api/types'
import { centsToInput, formatPrice, parsePrice } from './price'

const items = ref<ShopItem[]>([])
const loading = ref(true)
const listError = ref('')

// Formular "Neuen Artikel hinzufügen"
const newName = ref('')
const newPrice = ref('')
const createError = ref('')
const createSuccess = ref('')
const creating = ref(false)

// Zeile bearbeiten (immer nur eine gleichzeitig)
const editId = ref<number | null>(null)
const editName = ref('')
const editPrice = ref('')
const editError = ref('')
const saving = ref(false)

const errorText = (err: unknown, fallback: string) =>
  err instanceof ApiError ? err.message : fallback

const sortItems = (list: ShopItem[]) =>
  [...list].sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }))

async function loadItems() {
  try {
    const data = await api.get<{ items: ShopItem[] }>('/api/shop/items')
    items.value = sortItems(data.items)
    listError.value = ''
  } catch (err) {
    listError.value = errorText(err, 'Artikel konnten nicht geladen werden')
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
    createSuccess.value = `Artikel „${data.item.name}“ hinzugefügt.`
    newName.value = ''
    newPrice.value = ''
  } catch (err) {
    createError.value = errorText(err, 'Artikel konnte nicht hinzugefügt werden')
  } finally {
    creating.value = false
  }
}

function startEdit(item: ShopItem) {
  editId.value = item.id
  editName.value = item.name
  editPrice.value = centsToInput(item.priceCents)
  editError.value = ''
}

function cancelEdit() {
  editId.value = null
  editError.value = ''
}

async function saveEdit(item: ShopItem) {
  editError.value = ''
  const price = parsePrice(editPrice.value)
  if (!price.ok) {
    editError.value = 'Bitte einen gültigen Preis eingeben, z. B. 1,50'
    return
  }
  saving.value = true
  try {
    const data = await api.put<{ item: ShopItem }>(`/api/shop/items/${item.id}`, {
      name: editName.value.trim(),
      priceCents: price.cents,
    })
    items.value = sortItems(items.value.map((entry) => (entry.id === item.id ? data.item : entry)))
    cancelEdit()
  } catch (err) {
    editError.value = errorText(err, 'Artikel konnte nicht gespeichert werden')
  } finally {
    saving.value = false
  }
}

onMounted(loadItems)
</script>

<template>
  <div class="page-section shop-admin">
    <h1 class="page-title">Shopliste</h1>

    <form class="card glass-card" @submit.prevent="createItem">
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

    <section class="card glass-card">
      <h2>Artikel</h2>

      <p v-if="listError" class="form-error" role="alert">{{ listError }}</p>
      <p v-else-if="!loading && items.length === 0" class="empty">Noch keine Artikel angelegt.</p>

      <ul class="item-list">
        <li v-for="item in items" :key="item.id" class="item-row">
          <form
            v-if="editId === item.id"
            class="edit-form"
            @submit.prevent="saveEdit(item)"
            @keydown.esc="cancelEdit"
          >
            <div class="edit-fields">
              <label class="form-field">
                <span>Name</span>
                <input
                  v-model="editName"
                  class="form-input"
                  autocomplete="off"
                  maxlength="100"
                  required
                />
              </label>
              <label class="form-field">
                <span>Preis in €</span>
                <input
                  v-model="editPrice"
                  class="form-input"
                  inputmode="decimal"
                  autocomplete="off"
                  placeholder="z. B. 1,50"
                />
              </label>
            </div>

            <p v-if="editError" class="form-error" role="alert">{{ editError }}</p>

            <div class="row-buttons">
              <button type="submit" class="btn btn-small" :disabled="saving">Speichern</button>
              <button type="button" class="btn btn-secondary btn-small" @click="cancelEdit">
                Abbrechen
              </button>
            </div>
          </form>

          <template v-else>
            <div class="item-info">
              <strong class="item-name">{{ item.name }}</strong>
              <small>{{ formatPrice(item.priceCents) }}</small>
            </div>
            <button
              type="button"
              class="btn btn-secondary btn-small"
              :disabled="editId !== null"
              @click="startEdit(item)"
            >
              Bearbeiten
            </button>
          </template>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped lang="scss">
.shop-admin {
  max-width: 720px;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: clamp(1.25rem, 5vw, 2rem);

  & + & {
    margin-top: 1.25rem;
  }

  h2 {
    font-size: 1.15rem;
    color: var(--c-accent);
  }
}

.create-fields,
.edit-fields {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 1rem;
}

.empty {
  color: var(--c-text-muted);
}

.item-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.item-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.9rem 0;

  & + & {
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .edit-form {
    grid-column: 1 / -1;
  }
}

.item-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;

  .item-name {
    overflow-wrap: anywhere;
  }

  small {
    color: var(--c-text-muted);
  }
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.row-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.btn-small {
  min-height: 40px;
  padding: 0.5rem 0.85rem;
  font-size: 0.9rem;
}

/* 📱 MOBILE: Felder und Aktionen untereinander */
@media (max-width: 600px) {
  .create-fields,
  .edit-fields {
    grid-template-columns: 1fr;
  }

  .row-buttons .btn {
    flex: 1 1 auto;
  }
}
</style>
