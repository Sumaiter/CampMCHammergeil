import { describe, expect, it } from 'vitest'
import type { ShopOrder } from '@/api/types'
import {
  grandTotal,
  groupByRecipient,
  orderedByHint,
  parseServerDate,
  pdfFileName,
  totalsPerItem,
} from './listData'

let nextId = 1
const order = (over: Partial<ShopOrder>): ShopOrder => ({
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

describe('pdfFileName', () => {
  it('nutzt lokale Zeit und die Listen-ID', () => {
    const printedAt = '2026-10-10 08:05:00'
    const d = parseServerDate(printedAt)
    const p = (n: number) => String(n).padStart(2, '0')
    const expected = `einkaufsliste-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}-7.pdf`
    expect(pdfFileName(7, printedAt)).toBe(expected)
    expect(pdfFileName(7, printedAt)).toMatch(/^einkaufsliste-\d{4}-\d{2}-\d{2}-\d{4}-7\.pdf$/)
  })
})
