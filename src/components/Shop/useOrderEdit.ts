// Gemeinsame Logik zum Ändern/Löschen einzelner Bestellpositionen (Menge 1..999).
// Genutzt von "Aktuelle Liste" (eigene offene Positionen) und von den Admin-Ansichten
// gedruckter Listen (`/api/shop/printed-orders`).
import { ref } from 'vue'
import { api, ApiError, errorMessage } from '@/api/client'
import type { ShopOrder } from '@/api/types'

type Options = {
  // z. B. '/api/shop/orders' oder '/api/shop/printed-orders'
  basePath: string
  // Server hat die Änderung übernommen
  onSaved: (order: ShopOrder) => void | Promise<void>
  onRemoved: (order: ShopOrder) => void | Promise<void>
  // Position existiert so nicht mehr (404/409) -> Daten neu laden
  onStale: () => void | Promise<void>
}

export function useOrderEdit(options: Options) {
  const actionError = ref('')
  // Zeile, die gerade gespeichert oder gelöscht wird
  const busyId = ref<number | null>(null)
  // Eingaben im Mengenfeld pro Bestell-ID (vorbelegt mit der gespeicherten Menge)
  const drafts = ref<Record<number, number | string | null>>({})

  function syncDrafts(orders: ShopOrder[]) {
    drafts.value = Object.fromEntries(orders.map((order) => [order.id, order.quantity]))
  }

  // Gültige Menge (1..999) aus dem Eingabefeld, sonst null
  function draftQuantity(order: ShopOrder): number | null {
    const raw = drafts.value[order.id] ?? order.quantity
    const value = Number(raw)
    return raw !== '' && raw !== null && Number.isInteger(value) && value >= 1 && value <= 999
      ? value
      : null
  }

  const isChanged = (order: ShopOrder) => draftQuantity(order) !== order.quantity

  async function handleError(err: unknown, fallback: string) {
    actionError.value = errorMessage(err, fallback)
    if (err instanceof ApiError && (err.status === 404 || err.status === 409)) {
      await options.onStale()
    }
  }

  async function save(order: ShopOrder) {
    actionError.value = ''
    const quantity = draftQuantity(order)
    if (quantity === null) {
      actionError.value = 'Die Anzahl muss zwischen 1 und 999 liegen.'
      return
    }

    busyId.value = order.id
    try {
      const data = await api.put<{ order: ShopOrder }>(`${options.basePath}/${order.id}`, {
        quantity,
      })
      drafts.value[order.id] = data.order.quantity
      await options.onSaved(data.order)
    } catch (err) {
      await handleError(err, 'Anzahl konnte nicht gespeichert werden')
    } finally {
      busyId.value = null
    }
  }

  async function remove(order: ShopOrder) {
    if (!confirm(`„${order.itemName}“ wirklich von der Liste löschen?`)) return
    actionError.value = ''

    busyId.value = order.id
    try {
      await api.delete(`${options.basePath}/${order.id}`)
      delete drafts.value[order.id]
      await options.onRemoved(order)
    } catch (err) {
      await handleError(err, 'Bestellung konnte nicht gelöscht werden')
    } finally {
      busyId.value = null
    }
  }

  return { actionError, busyId, drafts, syncDrafts, draftQuantity, isChanged, save, remove }
}
