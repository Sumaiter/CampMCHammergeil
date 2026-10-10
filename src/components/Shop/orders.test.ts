import { describe, expect, it } from 'vitest'
import type { ShopOrder } from '@/api/types'
import {
  formatLineTotal,
  grandTotal,
  groupByList,
  groupByRecipient,
  orderedByHint,
  orderHint,
  ownTotal,
  totalsPerItem,
} from './orders'

let nextId = 1
const order = (over: Partial<ShopOrder> = {}): ShopOrder => ({
  id: nextId++,
  itemId: 1,
  itemName: 'Cola',
  priceCents: 100,
  quantity: 1,
  createdAt: '2026-10-10 10:00:00',
  userId: 1,
  username: 'anna',
  orderedById: 1,
  orderedByName: 'anna',
  listId: null,
  printedAt: null,
  ...over,
})
describe('totalsPerItem', () => {
  it('summiert gleiche Artikel über Personen hinweg', () => {
    const result = totalsPerItem([
      order({ itemId: 2, itemName: 'Bier', priceCents: 200, quantity: 2 }),
      order({
        itemId: 2,
        itemName: 'Bier',
        priceCents: 200,
        quantity: 3,
        userId: 2,
        username: 'ben',
      }),
      order({ itemId: 1, itemName: 'Cola', priceCents: 150, quantity: 1 }),
    ])
    expect(result.map((r) => [r.itemName, r.quantity, r.totalCents])).toEqual([
      ['Bier', 5, 1000],
      ['Cola', 1, 150],
    ])
  })

  it('behandelt Artikel ohne Preis', () => {
    const [entry] = totalsPerItem([order({ priceCents: null, quantity: 3 })])
    expect(entry).toMatchObject({ quantity: 3, priceCents: null, totalCents: null })
  })
})

describe('groupByRecipient', () => {
  const orders = [
    order({ userId: 2, username: 'ben', itemName: 'Cola', quantity: 2, priceCents: 150 }),
    order({ userId: 1, username: 'anna', itemName: 'Wasser', priceCents: null }),
    order({
      userId: 1,
      username: 'anna',
      itemId: 3,
      itemName: 'Bier',
      quantity: 2,
      priceCents: 200,
    }),
  ]

  it('gruppiert alphabetisch nach Empfänger mit Zwischensumme', () => {
    const groups = groupByRecipient(orders)
    expect(groups.map((g) => g.username)).toEqual(['anna', 'ben'])
    expect(groups[0]).toMatchObject({ totalCents: 400, unpricedCount: 1 })
    expect(groups[0]!.orders.map((o) => o.itemName)).toEqual(['Bier', 'Wasser'])
    expect(groups[1]).toMatchObject({ totalCents: 300, unpricedCount: 0 })
  })

  it('berechnet die Gesamtsumme', () => {
    expect(grandTotal(orders)).toEqual({ totalCents: 700, unpricedCount: 1 })
    expect(grandTotal([])).toEqual({ totalCents: 0, unpricedCount: 0 })
  })
})

describe('orderedByHint', () => {
  it('liefert den Besteller nur, wenn er vom Empfänger abweicht', () => {
    expect(orderedByHint(order({}))).toBeNull()
    expect(orderedByHint(order({ orderedByName: null }))).toBeNull()
    expect(orderedByHint(order({ orderedByName: 'ben' }))).toBe('ben')
  })
})

describe('formatLineTotal', () => {
  it('zeigt einen Strich ohne Preis', () => {
    expect(formatLineTotal(order({ priceCents: null }))).toBe('–')
  })
})

describe('ownTotal', () => {
  it('zählt nur Positionen für den Benutzer und meldet Positionen ohne Preis', () => {
    const orders = [
      order({ id: 1, priceCents: 150, quantity: 2 }),
      order({ id: 2, userId: 2, username: 'ben', priceCents: 1000, quantity: 1 }),
      order({ id: 3, priceCents: null }),
      order({ id: 4, priceCents: 50, quantity: 3 }),
    ]
    expect(ownTotal(orders, 1)).toEqual({ totalCents: 450, unpricedCount: 1 })
    expect(ownTotal(orders, 2)).toEqual({ totalCents: 1000, unpricedCount: 0 })
    expect(ownTotal([], 1)).toEqual({ totalCents: 0, unpricedCount: 0 })
  })
})

describe('orderHint', () => {
  it('gibt keinen Hinweis bei eigener Bestellung', () => {
    expect(orderHint(order(), 1)).toBeNull()
  })

  it('nennt den Empfänger, wenn für andere bestellt wurde', () => {
    expect(orderHint(order({ userId: 2, username: 'ben' }), 1)).toBe('für ben')
  })

  it('nennt den Besteller, wenn andere für mich bestellt haben', () => {
    expect(orderHint(order({ orderedById: 2, orderedByName: 'ben' }), 1)).toBe('von ben')
  })

  it('zeigt nichts bei gelöschtem Besteller', () => {
    expect(orderHint(order({ orderedById: null, orderedByName: null }), 1)).toBeNull()
  })
})

describe('groupByList', () => {
  it('gruppiert nach Liste und behält die Reihenfolge', () => {
    const printed = (id: number, listId: number, printedAt: string) =>
      order({ id, listId, printedAt })
    const groups = groupByList([
      printed(1, 5, '2026-10-10 12:00:00'),
      printed(2, 5, '2026-10-10 12:00:00'),
      printed(3, 4, '2026-10-09 08:00:00'),
      order({ id: 4 }),
    ])
    expect(groups.map((g) => [g.listId, g.orders.map((o) => o.id)])).toEqual([
      [5, [1, 2]],
      [4, [3]],
    ])
  })
})
