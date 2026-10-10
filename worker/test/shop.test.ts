import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, it } from 'vitest'
import { api, createUser, login, resetDb } from './helpers'

type Item = { id: number; name: string; priceCents: number | null }
type Order = {
  id: number
  itemName: string
  priceCents: number | null
  quantity: number
  createdAt: string
}

describe('/api/shop', () => {
  let adminCookie: string
  let userCookie: string
  let otherCookie: string

  const listItems = async () =>
    ((await (await api('/api/shop/items', { cookie: userCookie })).json()) as { items: Item[] })
      .items

  const createItem = (body: unknown, cookie = adminCookie) =>
    api('/api/shop/items', { method: 'POST', cookie, body })

  const addItem = async (name: string, priceCents?: number | null): Promise<Item> =>
    ((await (await createItem({ name, priceCents })).json()) as { item: Item }).item

  const updateItem = (id: number | string, body: unknown, cookie = adminCookie) =>
    api(`/api/shop/items/${id}`, { method: 'PUT', cookie, body })

  const order = (items: unknown, cookie = userCookie) =>
    api('/api/shop/orders', { method: 'POST', cookie, body: { items } })

  const listOrders = async (cookie = userCookie) =>
    ((await (await api('/api/shop/orders', { cookie })).json()) as { orders: Order[] }).orders

  beforeEach(async () => {
    await resetDb()
    await createUser('boss', 'geheim123', true)
    await createUser('josh', 'geheim123')
    await createUser('anna', 'geheim123')
    adminCookie = await login('boss', 'geheim123')
    userCookie = await login('josh', 'geheim123')
    otherCookie = await login('anna', 'geheim123')
  })

  describe('Zugriff', () => {
    it('liefert ohne Login 401', async () => {
      expect((await api('/api/shop/items')).status).toBe(401)
      expect((await api('/api/shop/items', { method: 'POST', body: { name: 'x' } })).status).toBe(
        401,
      )
      expect((await api('/api/shop/items/1', { method: 'PUT', body: { name: 'x' } })).status).toBe(
        401,
      )
      expect((await api('/api/shop/orders')).status).toBe(401)
      expect((await api('/api/shop/orders', { method: 'POST', body: { items: [] } })).status).toBe(
        401,
      )
    })

    it('verbietet normalen Benutzern das Anlegen und Ändern von Artikeln', async () => {
      const item = await addItem('Cola', 150)
      const created = await createItem({ name: 'Fanta' }, userCookie)
      expect(created.status).toBe(403)
      expect(await created.json()).toEqual({ error: 'Keine Berechtigung' })
      expect(
        (await updateItem(item.id, { name: 'Fanta', priceCents: 100 }, userCookie)).status,
      ).toBe(403)
      expect(await listItems()).toEqual([item])
    })
  })

  describe('Artikel anlegen', () => {
    it('legt Artikel mit Preis und getrimmtem Namen an', async () => {
      const res = await createItem({ name: '  Cola ', priceCents: 150 })
      expect(res.status).toBe(201)
      expect(await res.json()).toEqual({
        item: { id: expect.any(Number), name: 'Cola', priceCents: 150 },
      })
    })

    it('legt Artikel ohne Preis an', async () => {
      const res = await createItem({ name: 'Spende' })
      expect(res.status).toBe(201)
      expect(await res.json()).toEqual({
        item: { id: expect.any(Number), name: 'Spende', priceCents: null },
      })
    })

    it('akzeptiert Preis 0', async () => {
      const res = await createItem({ name: 'Gratis', priceCents: 0 })
      expect(res.status).toBe(201)
    })

    it('lehnt doppelten Namen unabhängig von Groß-/Kleinschreibung mit 409 ab', async () => {
      await addItem('Cola')
      const res = await createItem({ name: 'COLA' })
      expect(res.status).toBe(409)
      expect(await res.json()).toEqual({ error: 'Artikel existiert bereits' })
    })

    it.each([
      {},
      { name: '   ' },
      { name: 'x'.repeat(101) },
      { name: 5 },
      { name: 'a', priceCents: -1 },
      { name: 'a', priceCents: 1_000_001 },
      { name: 'a', priceCents: 1.5 },
      { name: 'a', priceCents: '100' },
    ])('lehnt ungültige Angaben %j mit 400 ab', async (body) => {
      expect((await createItem(body)).status).toBe(400)
    })
  })

  describe('Artikel auflisten', () => {
    it('sortiert alphabetisch ohne Beachtung der Groß-/Kleinschreibung', async () => {
      await addItem('bier', 200)
      await addItem('Zelt')
      await addItem('Apfelschorle', 100)
      await addItem('Cola', 150)
      expect((await listItems()).map((i) => i.name)).toEqual([
        'Apfelschorle',
        'bier',
        'Cola',
        'Zelt',
      ])
    })
  })

  describe('Artikel ändern', () => {
    it('ändert Name und Preis', async () => {
      const item = await addItem('Cola', 150)
      const res = await updateItem(item.id, { name: ' Cola Zero ', priceCents: null })
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({
        item: { id: item.id, name: 'Cola Zero', priceCents: null },
      })
      expect(await listItems()).toEqual([{ id: item.id, name: 'Cola Zero', priceCents: null }])
    })

    it('lehnt den Namen eines anderen Artikels mit 409 ab', async () => {
      await addItem('Cola')
      const fanta = await addItem('Fanta')
      const res = await updateItem(fanta.id, { name: 'cola', priceCents: null })
      expect(res.status).toBe(409)
      expect(await res.json()).toEqual({ error: 'Artikel existiert bereits' })
    })

    it('erlaubt, nur die Schreibweise des eigenen Namens zu ändern', async () => {
      const item = await addItem('cola', 150)
      const res = await updateItem(item.id, { name: 'Cola', priceCents: 150 })
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ item: { id: item.id, name: 'Cola', priceCents: 150 } })
    })

    it.each(['abc', '9999', '0', '-1', '1.5'])('liefert für id %s 404', async (id) => {
      const res = await updateItem(id, { name: 'Cola', priceCents: 100 })
      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({ error: 'Artikel nicht gefunden' })
    })

    it('lehnt ungültige Angaben mit 400 ab', async () => {
      const item = await addItem('Cola', 150)
      expect((await updateItem(item.id, { name: '', priceCents: 100 })).status).toBe(400)
      expect((await updateItem(item.id, { name: 'Cola', priceCents: -5 })).status).toBe(400)
    })
  })

  describe('Bestellungen', () => {
    let cola: Item
    let spende: Item

    beforeEach(async () => {
      cola = await addItem('Cola', 150)
      spende = await addItem('Spende')
    })

    it('legt Bestellung an und listet sie mit Artikelname, Preis und gemeinsamem Zeitstempel', async () => {
      const res = await order([
        { itemId: cola.id, quantity: 2 },
        { itemId: spende.id, quantity: 1 },
      ])
      expect(res.status).toBe(201)
      expect(await res.json()).toEqual({ ok: true })

      const orders = await listOrders()
      expect(orders).toEqual([
        {
          id: expect.any(Number),
          itemName: 'Cola',
          priceCents: 150,
          quantity: 2,
          createdAt: expect.any(String),
        },
        {
          id: expect.any(Number),
          itemName: 'Spende',
          priceCents: null,
          quantity: 1,
          createdAt: expect.any(String),
        },
      ])
      expect(orders[0]!.createdAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
      expect(orders[0]!.createdAt).toBe(orders[1]!.createdAt)
    })

    it('liefert nur die eigenen Bestellungen, neueste zuerst', async () => {
      await order([{ itemId: cola.id, quantity: 1 }])
      await order([{ itemId: spende.id, quantity: 3 }], otherCookie)
      // Ältere Bestellung künstlich zurückdatieren.
      await env.DB.prepare("UPDATE shop_orders SET created_at = '2020-01-01 10:00:00'").run()
      await order([{ itemId: spende.id, quantity: 4 }])

      expect((await listOrders()).map((o) => [o.itemName, o.quantity])).toEqual([
        ['Spende', 4],
        ['Cola', 1],
      ])
      expect((await listOrders(otherCookie)).map((o) => [o.itemName, o.quantity])).toEqual([
        ['Spende', 3],
      ])
    })

    it('liefert ohne Bestellungen eine leere Liste', async () => {
      expect(await listOrders()).toEqual([])
    })

    it('lehnt leere Bestellung mit 400 ab', async () => {
      for (const items of [[], undefined, 'x']) {
        const res = await order(items)
        expect(res.status).toBe(400)
        expect(await res.json()).toEqual({ error: 'Keine Artikel ausgewählt' })
      }
    })

    it.each([0, -1, 1000, 1.5, '2', null])('lehnt Menge %j mit 400 ab', async (quantity) => {
      const res = await order([{ itemId: cola.id, quantity }])
      expect(res.status).toBe(400)
      expect(await listOrders()).toEqual([])
    })

    it('akzeptiert die Mengen 1 und 999', async () => {
      const res = await order([
        { itemId: cola.id, quantity: 999 },
        { itemId: spende.id, quantity: 1 },
      ])
      expect(res.status).toBe(201)
    })

    it('lehnt unbekannten Artikel mit 400 ab und legt nichts an', async () => {
      const res = await order([
        { itemId: cola.id, quantity: 1 },
        { itemId: 9999, quantity: 1 },
      ])
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'Unbekannter Artikel' })
      expect(await listOrders()).toEqual([])
    })

    it('lehnt ungültige Einträge mit 400 ab', async () => {
      expect((await order([null])).status).toBe(400)
      expect((await order([{ quantity: 1 }])).status).toBe(400)
      expect((await order([{ itemId: '1', quantity: 1 }])).status).toBe(400)
    })

    it('lehnt doppelte Artikel mit 400 ab', async () => {
      const res = await order([
        { itemId: cola.id, quantity: 1 },
        { itemId: cola.id, quantity: 2 },
      ])
      expect(res.status).toBe(400)
      expect(await listOrders()).toEqual([])
    })

    it('verschwindet mit dem Benutzer, ohne das Löschen zu blockieren', async () => {
      await order([{ itemId: cola.id, quantity: 1 }])
      const res = await api('/api/auth/account', {
        method: 'DELETE',
        cookie: userCookie,
        body: { password: 'geheim123' },
      })
      expect(res.status).toBe(200)
      const left = await env.DB.prepare('SELECT COUNT(*) AS n FROM shop_orders').first<{
        n: number
      }>()
      expect(left?.n).toBe(0)
    })
  })
})
