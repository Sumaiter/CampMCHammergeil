// Reine Aufbereitung von Bestellpositionen für Anzeige, Vorschau und PDF (kein DOM, kein jsPDF).
import type { ShopOrder } from '@/api/types'
import { formatPriceOrDash } from './price'

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

export type OrderGroup = { listId: number; printedAt: string; orders: ShopOrder[] }

const byName = (a: string, b: string) => a.localeCompare(b, 'de', { sensitivity: 'base' })

// Summe einer Position in Cent, null = Artikel hat (noch) keinen Preis.
export const lineTotal = (order: ShopOrder): number | null =>
  order.priceCents === null ? null : order.priceCents * order.quantity

export const formatLineTotal = (order: ShopOrder): string => formatPriceOrDash(lineTotal(order))

// Summe aller Positionen; Positionen ohne Preis zählen nicht (werden aber gemeldet).
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

// Was `userId` selbst bezahlen muss: nur Positionen, die für ihn bestellt wurden.
export function ownTotal(orders: ShopOrder[], userId: number) {
  return grandTotal(orders.filter((order) => order.userId === userId))
}

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
  const map = new Map<number, ShopOrder[]>()
  for (const order of orders) {
    const list = map.get(order.userId)
    if (list) list.push(order)
    else map.set(order.userId, [order])
  }
  const groups: PersonGroup[] = [...map.values()].map((list) => {
    list.sort((a, b) => byName(a.itemName, b.itemName) || a.id - b.id)
    return {
      userId: list[0]!.userId,
      username: list[0]!.username,
      orders: list,
      ...grandTotal(list),
    }
  })
  return groups.sort((a, b) => byName(a.username, b.username) || a.userId - b.userId)
}

// Gruppiert gedruckte Positionen nach Liste, Reihenfolge des ersten Auftretens bleibt erhalten.
export function groupByList(orders: ShopOrder[]): OrderGroup[] {
  const groups = new Map<number, OrderGroup>()
  for (const order of orders) {
    if (order.listId === null || order.printedAt === null) continue
    let group = groups.get(order.listId)
    if (!group) {
      group = { listId: order.listId, printedAt: order.printedAt, orders: [] }
      groups.set(order.listId, group)
    }
    group.orders.push(order)
  }
  return [...groups.values()]
}

// Hinweiszeile aus Sicht von `userId`: "für <Empfänger>" bzw. "von <Besteller>", sonst null.
export function orderHint(order: ShopOrder, userId: number): string | null {
  if (order.userId !== userId) return `für ${order.username}`
  if (order.orderedById !== null && order.orderedById !== userId && order.orderedByName) {
    return `von ${order.orderedByName}`
  }
  return null
}

// "bestellt von X" nur, wenn jemand anderes als der Empfänger bestellt hat.
export function orderedByHint(order: ShopOrder): string | null {
  if (!order.orderedByName || order.orderedByName === order.username) return null
  return order.orderedByName
}
