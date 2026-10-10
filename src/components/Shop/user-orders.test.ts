import { describe, expect, it } from 'vitest'
import type { ShopOrder } from '@/api/types'
import {
  formatLineTotal,
  formatListTitle,
  groupByList,
  orderHint,
  ownTotal,
  parseServerDate,
} from './user-orders'

const order = (overrides: Partial<ShopOrder> = {}): ShopOrder => ({
  id: 1,
  itemId: 1,
  itemName: 'Cola',
  priceCents: 150,
  quantity: 2,
  createdAt: '2026-10-10 12:30:00',
  userId: 1,
  username: 'anna',
  orderedById: 1,
  orderedByName: 'anna',
  listId: null,
  printedAt: null,
  ...overrides,
})

describe('parseServerDate', () => {
  it('liest Serverzeit als UTC', () => {
    expect(parseServerDate('2026-10-10 12:30:00').toISOString()).toBe('2026-10-10T12:30:00.000Z')
  })
})

describe('formatListTitle', () => {
  it('nennt Datum und Uhrzeit', () => {
    expect(formatListTitle('2026-10-10 12:30:00')).toMatch(
      /^Liste vom \d{2}\.\d{2}\.\d{4}, \d{2}:\d{2} Uhr$/,
    )
  })

  it('unterscheidet zwei Drucke am selben Tag', () => {
    expect(formatListTitle('2026-10-10 08:00:00')).not.toBe(formatListTitle('2026-10-10 09:15:00'))
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
