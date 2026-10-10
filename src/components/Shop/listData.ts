// Reine Aufbereitung von Bestellpositionen für Vorschau und PDF (kein DOM, kein jsPDF).
import type { ShopOrder } from '@/api/types'

export type ItemTotal = {
  itemId: number
  itemName: string
  priceCents: number | null
  quantity: number
  // null = kein Preis
  totalCents: number | null
}

export type PersonGroup = {
  userId: number
  username: string
  orders: ShopOrder[]
  totalCents: number
  unpricedCount: number
}

export const lineTotal = (order: ShopOrder): number | null =>
  order.priceCents === null ? null : order.priceCents * order.quantity

const byName = (a: string, b: string) => a.localeCompare(b, 'de', { sensitivity: 'base' })

// "Gesamt pro Artikel": gleiche Artikel (und gleicher Preis) werden aufsummiert.
export function totalsPerItem(orders: ShopOrder[]): ItemTotal[] {
  const map = new Map<string, ItemTotal>()
  for (const order of orders) {
    const key = `${order.itemId}:${order.priceCents ?? 'null'}`
    const entry = map.get(key)
    if (entry) {
      entry.quantity += order.quantity
    } else {
      map.set(key, {
        itemId: order.itemId,
        itemName: order.itemName,
        priceCents: order.priceCents,
        quantity: order.quantity,
        totalCents: null,
      })
    }
  }
  const result = [...map.values()]
  for (const entry of result) {
    entry.totalCents = entry.priceCents === null ? null : entry.priceCents * entry.quantity
  }
  return result.sort((a, b) => byName(a.itemName, b.itemName) || a.itemId - b.itemId)
}

// "Pro Person": nach Empfänger gruppiert (alphabetisch), Positionen nach Artikel sortiert.
export function groupByRecipient(orders: ShopOrder[]): PersonGroup[] {
  const map = new Map<number, PersonGroup>()
  for (const order of orders) {
    let group = map.get(order.userId)
    if (!group) {
      group = {
        userId: order.userId,
        username: order.username,
        orders: [],
        totalCents: 0,
        unpricedCount: 0,
      }
      map.set(order.userId, group)
    }
    group.orders.push(order)
    const total = lineTotal(order)
    if (total === null) group.unpricedCount++
    else group.totalCents += total
  }
  const groups = [...map.values()]
  for (const group of groups) {
    group.orders.sort((a, b) => byName(a.itemName, b.itemName) || a.id - b.id)
  }
  return groups.sort((a, b) => byName(a.username, b.username) || a.userId - b.userId)
}

export function grandTotal(orders: ShopOrder[]): { totalCents: number; unpricedCount: number } {
  let totalCents = 0
  let unpricedCount = 0
  for (const order of orders) {
    const total = lineTotal(order)
    if (total === null) unpricedCount++
    else totalCents += total
  }
  return { totalCents, unpricedCount }
}

// "bestellt von X" nur, wenn jemand anderes als der Empfänger bestellt hat.
export function orderedByHint(order: ShopOrder): string | null {
  if (!order.orderedByName || order.orderedByName === order.username) return null
  return order.orderedByName
}

// Server liefert UTC "YYYY-MM-DD HH:MM:SS"
export const parseServerDate = (value: string): Date => new Date(value.replace(' ', 'T') + 'Z')

const dateFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' })
const timeFormat = new Intl.DateTimeFormat('de-DE', { timeStyle: 'short' })
export const formatPrintedDate = (value: string) => dateFormat.format(parseServerDate(value))
export const formatPrintedTime = (value: string) => timeFormat.format(parseServerDate(value))

const pad = (n: number) => String(n).padStart(2, '0')

// einkaufsliste-YYYY-MM-DD-HHMM-<id>.pdf (lokale Zeit)
export function pdfFileName(id: number, printedAt: string): string {
  const d = parseServerDate(printedAt)
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return `einkaufsliste-${date}-${pad(d.getHours())}${pad(d.getMinutes())}-${id}.pdf`
}
