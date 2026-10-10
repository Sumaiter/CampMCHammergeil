// Gemeinsame Helfer für Aktuelle Liste und Übersicht (Anzeige eigener Bestellpositionen).

import type { ShopOrder } from '@/api/types'
import { formatPrice } from './price'

const dateFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' })
const timeFormat = new Intl.DateTimeFormat('de-DE', { timeStyle: 'short' })

// Der Server liefert UTC im Format "YYYY-MM-DD HH:MM:SS".
export function parseServerDate(value: string): Date {
  return new Date(value.replace(' ', 'T') + 'Z')
}

// "2026-10-10 12:30:00" -> lokal, z. B. "10.10.2026, 14:30"
export function formatDateTime(value: string): string {
  const date = parseServerDate(value)
  return `${dateFormat.format(date)}, ${timeFormat.format(date)}`
}

// Titel einer gedruckten Liste; die Uhrzeit unterscheidet mehrere Drucke am selben Tag.
export function formatListTitle(printedAt: string): string {
  return `Liste vom ${formatDateTime(printedAt)} Uhr`
}

// Summe einer Position in Cent, null = Artikel hat (noch) keinen Preis.
export function lineTotal(order: ShopOrder): number | null {
  return order.priceCents === null ? null : order.priceCents * order.quantity
}

export function formatLineTotal(order: ShopOrder): string {
  const total = lineTotal(order)
  return total === null ? '–' : formatPrice(total)
}

// Was `userId` selbst bezahlen muss: nur Positionen, die für ihn bestellt wurden,
// Positionen ohne Preis zählen nicht (werden aber gemeldet).
export function ownTotal(
  orders: ShopOrder[],
  userId: number,
): { totalCents: number; unpricedCount: number } {
  let totalCents = 0
  let unpricedCount = 0
  for (const order of orders) {
    if (order.userId !== userId) continue
    const total = lineTotal(order)
    if (total === null) unpricedCount++
    else totalCents += total
  }
  return { totalCents, unpricedCount }
}

// Hinweiszeile aus Sicht von `userId`: "für <Empfänger>" bzw. "von <Besteller>", sonst null.
export function orderHint(order: ShopOrder, userId: number): string | null {
  if (order.userId !== userId) return `für ${order.username}`
  if (order.orderedById !== null && order.orderedById !== userId && order.orderedByName) {
    return `von ${order.orderedByName}`
  }
  return null
}

export type OrderGroup = { listId: number; printedAt: string; orders: ShopOrder[] }

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
