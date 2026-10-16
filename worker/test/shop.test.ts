import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, it } from 'vitest'
import { api, createUser, login, resetDb } from './helpers'

type Item = { id: number; name: string; priceCents: number | null }
type Order = {
  id: number
  itemId: number
  itemName: string
  priceCents: number | null
  quantity: number
  createdAt: string
  userId: number
  username: string
  orderedById: number | null
  orderedByName: string | null
  listId: number | null
  printedAt: string | null
}
type ListDetail = {
  id: number
  printedAt: string
  printedByName: string | null
  orders: Order[]
}
type ShopList = Omit<ListDetail, 'orders'> & {
  orderCount: number
  totalCents: number
  unpricedCount: number
}
type Balance = { userId: number; username: string; totalCents: number; unpricedCount: number }

const TIMESTAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/

describe('/api/shop', () => {
  let adminCookie: string
  let userCookie: string
  let otherCookie: string
  let adminId: number
  let userId: number
  let otherId: number

  const listItems = async () =>
    ((await (await api('/api/shop/items', { cookie: userCookie })).json()) as { items: Item[] })
      .items

  const createItem = (body: unknown, cookie = adminCookie) =>
    api('/api/shop/items', { method: 'POST', cookie, body })

  const addItem = async (name: string, priceCents?: number | null): Promise<Item> =>
    ((await (await createItem({ name, priceCents })).json()) as { item: Item }).item

  const updateItem = (id: number | string, body: unknown, cookie = adminCookie) =>
    api(`/api/shop/items/${id}`, { method: 'PUT', cookie, body })

  const order = (items: unknown, cookie = userCookie, forUserId?: unknown) =>
    api('/api/shop/orders', { method: 'POST', cookie, body: { items, forUserId } })

  const getJson = async <T>(path: string, cookie = userCookie): Promise<T> =>
    (await (await api(path, { cookie })).json()) as T

  const listOrders = async (cookie = userCookie) =>
    (await getJson<{ orders: Order[] }>('/api/shop/orders', cookie)).orders

  const updateOrder = (id: number | string, body: unknown, cookie = userCookie) =>
    api(`/api/shop/orders/${id}`, { method: 'PUT', cookie, body })

  const deleteOrder = (id: number | string, cookie = userCookie) =>
    api(`/api/shop/orders/${id}`, { method: 'DELETE', cookie })

  const openOrders = async () =>
    (await getJson<{ orders: Order[] }>('/api/shop/open-orders', adminCookie)).orders

  const print = (cookie = adminCookie) =>
    api('/api/shop/lists', { method: 'POST', cookie, body: {} })

  const printList = async (): Promise<ListDetail> => {
    const res = await print()
    expect(res.status).toBe(201)
    return ((await res.json()) as { list: ListDetail }).list
  }

  const getList = async (id: number) =>
    (await getJson<{ list: ListDetail }>(`/api/shop/lists/${id}`, adminCookie)).list

  const lists = async () =>
    (await getJson<{ lists: ShopList[] }>('/api/shop/lists', adminCookie)).lists

  const overview = async (cookie = userCookie, query = '') =>
    (await getJson<{ orders: Order[] }>(`/api/shop/overview${query}`, cookie)).orders

  const balances = async () =>
    (await getJson<{ balances: Balance[] }>('/api/shop/balances', adminCookie)).balances

  beforeEach(async () => {
    await resetDb()
    adminId = await createUser('boss', 'geheim123', true)
    userId = await createUser('josh', 'geheim123')
    otherId = await createUser('anna', 'geheim123')
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
      for (const path of ['users', 'open-orders', 'lists', 'lists/1', 'overview', 'balances']) {
        expect((await api(`/api/shop/${path}`)).status).toBe(401)
      }
      expect(
        (await api('/api/shop/orders/1', { method: 'PUT', body: { quantity: 1 } })).status,
      ).toBe(401)
      expect((await api('/api/shop/orders/1', { method: 'DELETE' })).status).toBe(401)
      expect((await api('/api/shop/lists', { method: 'POST', body: {} })).status).toBe(401)
      expect(
        (await api('/api/shop/printed-orders/1', { method: 'PUT', body: { quantity: 1 } })).status,
      ).toBe(401)
      expect((await api('/api/shop/printed-orders/1', { method: 'DELETE' })).status).toBe(401)
    })

    it('verbietet normalen Benutzern die Admin-Bereiche des Shops', async () => {
      for (const path of ['open-orders', 'lists', 'lists/1', 'balances']) {
        const res = await api(`/api/shop/${path}`, { cookie: userCookie })
        expect(res.status).toBe(403)
        expect(await res.json()).toEqual({ error: 'Keine Berechtigung' })
      }
      expect((await print(userCookie)).status).toBe(403)
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

    it('sortiert nach insgesamt bestellter Menge (auch gedruckt, alle Benutzer), dann nach Name', async () => {
      const apfel = await addItem('Apfelschorle')
      const bier = await addItem('Bier')
      const cola = await addItem('Cola')
      await addItem('Dose')
      expect((await order([{ itemId: bier.id, quantity: 2 }])).status).toBe(201)
      expect((await print()).status).toBe(201)
      expect((await order([{ itemId: cola.id, quantity: 1 }], otherCookie)).status).toBe(201)
      expect((await order([{ itemId: cola.id, quantity: 1 }])).status).toBe(201)
      expect((await order([{ itemId: apfel.id, quantity: 2 }], otherCookie)).status).toBe(201)
      // Alle drei haben Menge 2 (Gleichstand nach Name); Dose ohne Bestellung kommt zuletzt
      expect((await listItems()).map((i) => i.name)).toEqual([
        'Apfelschorle',
        'Bier',
        'Cola',
        'Dose',
      ])
      expect((await order([{ itemId: cola.id, quantity: 1 }])).status).toBe(201)
      expect((await listItems()).map((i) => i.name)).toEqual([
        'Cola',
        'Apfelschorle',
        'Bier',
        'Dose',
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

      const own = {
        userId,
        username: 'josh',
        orderedById: userId,
        orderedByName: 'josh',
        listId: null,
        printedAt: null,
      }
      const orders = await listOrders()
      expect(orders).toEqual([
        {
          id: expect.any(Number),
          itemId: cola.id,
          itemName: 'Cola',
          priceCents: 150,
          quantity: 2,
          createdAt: expect.any(String),
          ...own,
        },
        {
          id: expect.any(Number),
          itemId: spende.id,
          itemName: 'Spende',
          priceCents: null,
          quantity: 1,
          createdAt: expect.any(String),
          ...own,
        },
      ])
      expect(orders[0]!.createdAt).toMatch(TIMESTAMP)
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

    it('lehnt mehr als 100 Positionen in einer Bestellung mit 400 ab', async () => {
      const items = Array.from({ length: 101 }, (_, i) => ({ itemId: i + 1, quantity: 1 }))
      const res = await order(items)
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'Höchstens 100 Artikel pro Bestellung' })
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

    it('bleibt erhalten, wenn der Benutzer sein Konto löscht', async () => {
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
      expect(left?.n).toBe(1)
    })
  })

  describe('Einkaufen für andere, Listen und Übersicht', () => {
    let cola: Item
    let spende: Item

    // Bestellt einen Artikel und liefert die ID der neuen Position.
    const orderOne = async (
      item: Item,
      quantity = 1,
      cookie = userCookie,
      forUserId?: number | null,
    ): Promise<number> => {
      expect((await order([{ itemId: item.id, quantity }], cookie, forUserId)).status).toBe(201)
      const row = await env.DB.prepare('SELECT MAX(id) AS id FROM shop_orders').first<{
        id: number
      }>()
      return row!.id
    }

    beforeEach(async () => {
      cola = await addItem('Cola', 150)
      spende = await addItem('Spende')
    })

    describe('Benutzerliste', () => {
      it('liefert alle Benutzer alphabetisch', async () => {
        expect(await getJson('/api/shop/users')).toEqual({
          users: [
            { id: otherId, username: 'anna' },
            { id: adminId, username: 'boss' },
            { id: userId, username: 'josh' },
          ],
        })
      })
    })

    describe('Gelöschte Benutzer', () => {
      const deleteAccount = (cookie: string) =>
        api('/api/auth/account', { method: 'DELETE', cookie, body: { password: 'geheim123' } })

      it('bleiben in Übersicht, Listen und Salden sichtbar, aber nicht in der Benutzerliste', async () => {
        await orderOne(cola, 2, otherCookie)
        await orderOne(cola, 1, userCookie, otherId)
        const printed = await printList()
        await orderOne(spende, 1, otherCookie)
        expect((await deleteAccount(otherCookie)).status).toBe(200)

        const users = (await getJson<{ users: { id: number }[] }>('/api/shop/users')).users
        expect(users.map((u) => u.id)).not.toContain(otherId)
        expect((await overview()).map((o) => o.username)).toContain('anna')
        expect((await getList(printed.id)).orders.map((o) => o.username)).toContain('anna')
        expect((await openOrders()).map((o) => o.username)).toEqual(['anna'])
        expect(await balances()).toEqual([
          { userId: otherId, username: 'anna', totalCents: 450, unpricedCount: 0 },
        ])
      })

      it('können nicht mehr als Empfänger gewählt werden', async () => {
        await deleteAccount(otherCookie)
        const res = await order([{ itemId: cola.id, quantity: 1 }], userCookie, otherId)
        expect(res.status).toBe(400)
        expect(await res.json()).toEqual({ error: 'Unbekannter Benutzer' })
      })
    })

    describe('Bestellen für andere', () => {
      it('zeigt die Position beiden, berechnet sie aber nur dem Empfänger', async () => {
        await orderOne(cola, 2, userCookie, otherId)

        const expected = {
          itemName: 'Cola',
          quantity: 2,
          userId: otherId,
          username: 'anna',
          orderedById: userId,
          orderedByName: 'josh',
          listId: null,
        }
        expect(await listOrders(userCookie)).toEqual([expect.objectContaining(expected)])
        expect(await listOrders(otherCookie)).toEqual([expect.objectContaining(expected)])
        expect(await listOrders(adminCookie)).toEqual([])

        const list = await printList()
        expect(await overview(userCookie)).toEqual([
          expect.objectContaining({ ...expected, listId: list.id }),
        ])
        expect(await overview(otherCookie)).toEqual([
          expect.objectContaining({ ...expected, listId: list.id }),
        ])
        expect(await balances()).toEqual([
          { userId: otherId, username: 'anna', totalCents: 300, unpricedCount: 0 },
        ])
      })

      it('bestellt mit forUserId null für sich selbst', async () => {
        await orderOne(cola, 1, userCookie, null)
        expect(await listOrders()).toEqual([
          expect.objectContaining({ userId, orderedById: userId }),
        ])
      })

      it.each([9999, 0, -1, 1.5, '2', true])('lehnt Empfänger %j mit 400 ab', async (forUserId) => {
        const res = await order([{ itemId: cola.id, quantity: 1 }], userCookie, forUserId)
        expect(res.status).toBe(400)
        expect(await res.json()).toEqual({ error: 'Unbekannter Benutzer' })
        expect(await listOrders()).toEqual([])
      })

      it('behält die Position, wenn der Besteller sein Konto löscht', async () => {
        await orderOne(cola, 1, userCookie, otherId)
        const res = await api('/api/auth/account', {
          method: 'DELETE',
          cookie: userCookie,
          body: { password: 'geheim123' },
        })
        expect(res.status).toBe(200)
        expect(await listOrders(otherCookie)).toEqual([
          expect.objectContaining({ userId: otherId, orderedById: userId, orderedByName: 'josh' }),
        ])
      })
    })

    describe('Bestellung ändern und löschen', () => {
      it('erlaubt Empfänger und Besteller, die Menge zu ändern', async () => {
        const id = await orderOne(cola, 1, userCookie, otherId)

        const byRecipient = await updateOrder(id, { quantity: 5 }, otherCookie)
        expect(byRecipient.status).toBe(200)
        expect(await byRecipient.json()).toEqual({
          order: {
            id,
            itemId: cola.id,
            itemName: 'Cola',
            priceCents: 150,
            quantity: 5,
            createdAt: expect.stringMatching(TIMESTAMP),
            userId: otherId,
            username: 'anna',
            orderedById: userId,
            orderedByName: 'josh',
            listId: null,
            printedAt: null,
          },
        })

        const byOrderer = await updateOrder(id, { quantity: 7 }, userCookie)
        expect(byOrderer.status).toBe(200)
        expect(((await byOrderer.json()) as { order: Order }).order.quantity).toBe(7)
      })

      it('erlaubt dem Empfänger das Löschen', async () => {
        const id = await orderOne(cola, 1, userCookie, otherId)
        const res = await deleteOrder(id, otherCookie)
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ ok: true })
        expect(await listOrders()).toEqual([])
      })

      it('erlaubt dem Besteller das Löschen', async () => {
        const id = await orderOne(cola, 1, userCookie, otherId)
        expect((await deleteOrder(id, userCookie)).status).toBe(200)
        expect(await listOrders(otherCookie)).toEqual([])
      })

      it('liefert unbeteiligten Benutzern (auch Admins) 404', async () => {
        const id = await orderOne(cola, 2, userCookie, otherId)
        for (const res of [
          await updateOrder(id, { quantity: 3 }, adminCookie),
          await deleteOrder(id, adminCookie),
        ]) {
          expect(res.status).toBe(404)
          expect(await res.json()).toEqual({ error: 'Bestellung nicht gefunden' })
        }
        expect(await listOrders()).toEqual([expect.objectContaining({ id, quantity: 2 })])
      })

      it.each(['9999', 'abc', '0', '1.5'])('liefert für id %s 404', async (id) => {
        expect((await updateOrder(id, { quantity: 1 })).status).toBe(404)
        expect((await deleteOrder(id)).status).toBe(404)
      })

      it.each([0, 1000, 1.5, '2', null])('lehnt Menge %j mit 400 ab', async (quantity) => {
        const id = await orderOne(cola, 2)
        expect((await updateOrder(id, { quantity })).status).toBe(400)
        expect(await listOrders()).toEqual([expect.objectContaining({ quantity: 2 })])
      })

      it('lehnt Änderungen nach dem Drucken mit 409 ab', async () => {
        const id = await orderOne(cola, 2)
        await printList()
        for (const res of [await updateOrder(id, { quantity: 3 }), await deleteOrder(id)]) {
          expect(res.status).toBe(409)
          expect(await res.json()).toEqual({ error: 'Liste wurde bereits gedruckt' })
        }
        expect(await overview()).toEqual([expect.objectContaining({ id, quantity: 2 })])
        // Unbeteiligte erfahren auch bei gedruckten Positionen nichts.
        expect((await deleteOrder(id, otherCookie)).status).toBe(404)
      })
    })

    describe('Offene Bestellungen (Admin)', () => {
      it('liefert alle offenen Positionen sortiert nach Empfänger und Artikel', async () => {
        await orderOne(spende, 1, userCookie)
        await orderOne(cola, 1, userCookie)
        await orderOne(cola, 3, otherCookie)
        await orderOne(spende, 2, adminCookie, otherId)
        expect((await openOrders()).map((o) => [o.username, o.itemName, o.quantity])).toEqual([
          ['anna', 'Cola', 3],
          ['anna', 'Spende', 2],
          ['josh', 'Cola', 1],
          ['josh', 'Spende', 1],
        ])
      })
    })

    describe('Liste drucken', () => {
      it('verschiebt alle offenen Positionen in eine neue Liste', async () => {
        await orderOne(cola, 2, userCookie)
        await orderOne(spende, 1, otherCookie)

        const res = await print()
        expect(res.status).toBe(201)
        const { list } = (await res.json()) as { list: ListDetail }
        expect(list).toEqual({
          id: expect.any(Number),
          printedAt: expect.stringMatching(TIMESTAMP),
          printedByName: 'boss',
          orders: [
            expect.objectContaining({ username: 'anna', itemName: 'Spende', priceCents: null }),
            expect.objectContaining({ username: 'josh', itemName: 'Cola', priceCents: 150 }),
          ],
        })
        for (const o of list.orders) {
          expect(o.listId).toBe(list.id)
          expect(o.printedAt).toBe(list.printedAt)
        }

        expect(await listOrders(userCookie)).toEqual([])
        expect(await listOrders(otherCookie)).toEqual([])
        expect(await openOrders()).toEqual([])
        expect(await overview(userCookie)).toEqual([
          expect.objectContaining({ itemName: 'Cola', listId: list.id, printedAt: list.printedAt }),
        ])
        expect(await getList(list.id)).toEqual(list)
      })

      it('schreibt den Preis beim Drucken fest, fehlende Preise werden nachgetragen', async () => {
        await orderOne(cola, 2)
        await orderOne(spende, 1)
        const list = await printList()

        await updateItem(cola.id, { name: 'Cola', priceCents: 200 })
        await updateItem(spende.id, { name: 'Spende', priceCents: 50 })

        expect((await getList(list.id)).orders.map((o) => [o.itemName, o.priceCents])).toEqual([
          ['Cola', 150],
          ['Spende', 50],
        ])
        expect((await lists())[0]).toMatchObject({ totalCents: 350, unpricedCount: 0 })

        // Neue offene Positionen zeigen den aktuellen Preis.
        await orderOne(cola, 1)
        expect((await listOrders())[0]!.priceCents).toBe(200)
      })

      it('lehnt den Druck ohne offene Positionen mit 400 ab', async () => {
        const res = await print()
        expect(res.status).toBe(400)
        expect(await res.json()).toEqual({ error: 'Keine offenen Bestellungen' })

        await orderOne(cola)
        await printList()
        expect((await print()).status).toBe(400)
        expect(await lists()).toHaveLength(1)
      })

      it('unterscheidet mehrere Drucke und lässt spätere Bestellungen offen', async () => {
        await orderOne(cola)
        const first = await printList()
        await orderOne(spende, 2, otherCookie)
        expect(await openOrders()).toHaveLength(1)
        const second = await printList()

        expect(second.id).not.toBe(first.id)
        expect(first.orders.map((o) => o.itemName)).toEqual(['Cola'])
        expect(second.orders.map((o) => o.itemName)).toEqual(['Spende'])
        expect((await lists()).map((l) => [l.id, l.orderCount])).toEqual([
          [second.id, 1],
          [first.id, 1],
        ])
      })
    })

    describe('Alte Listen', () => {
      it('liefert Summe und Anzahl der Positionen ohne Preis', async () => {
        await orderOne(cola, 2, userCookie)
        await orderOne(spende, 1, userCookie)
        await orderOne(cola, 1, otherCookie)
        const list = await printList()
        expect(await lists()).toEqual([
          {
            id: list.id,
            printedAt: list.printedAt,
            printedByName: 'boss',
            orderCount: 3,
            totalCents: 450,
            unpricedCount: 1,
          },
        ])
      })

      it('liefert ohne Listen eine leere Liste', async () => {
        expect(await lists()).toEqual([])
      })

      it.each(['9999', 'abc', '0'])('liefert für Liste %s 404', async (id) => {
        const res = await api(`/api/shop/lists/${id}`, { cookie: adminCookie })
        expect(res.status).toBe(404)
        expect(await res.json()).toEqual({ error: 'Liste nicht gefunden' })
      })
    })

    describe('Übersicht', () => {
      it('zeigt nur gedruckte Positionen, neueste Liste zuerst', async () => {
        await orderOne(spende)
        await orderOne(cola)
        const first = await printList()
        await orderOne(cola, 4)
        const second = await printList()
        await orderOne(spende, 9) // offen, gehört nicht in die Übersicht

        expect((await overview()).map((o) => [o.listId, o.itemName, o.quantity])).toEqual([
          [second.id, 'Cola', 4],
          [first.id, 'Cola', 1],
          [first.id, 'Spende', 1],
        ])
      })

      it('verbietet normalen Benutzern fremde Übersichten', async () => {
        const res = await api(`/api/shop/overview?userId=${otherId}`, { cookie: userCookie })
        expect(res.status).toBe(403)
        expect(await res.json()).toEqual({ error: 'Keine Berechtigung' })
        const own = await api(`/api/shop/overview?userId=${userId}`, { cookie: userCookie })
        expect(own.status).toBe(200)
      })

      it('lässt Admins die Übersicht anderer Benutzer sehen', async () => {
        await orderOne(cola, 2)
        await printList()
        expect(await overview(adminCookie)).toEqual([])
        expect(await overview(adminCookie, `?userId=${userId}`)).toEqual([
          expect.objectContaining({ userId, itemName: 'Cola', quantity: 2 }),
        ])
      })

      it('lehnt ungültige userId mit 400 ab', async () => {
        const res = await api('/api/shop/overview?userId=abc', { cookie: adminCookie })
        expect(res.status).toBe(400)
      })
    })

    describe('Gedruckte Positionen bearbeiten (Admin)', () => {
      const updatePrinted = (id: number | string, body: unknown, cookie = adminCookie) =>
        api(`/api/shop/printed-orders/${id}`, { method: 'PUT', cookie, body })

      const deletePrinted = (id: number | string, cookie = adminCookie) =>
        api(`/api/shop/printed-orders/${id}`, { method: 'DELETE', cookie })

      it('verbietet normalen Benutzern das Ändern und Löschen', async () => {
        const id = await orderOne(cola, 2)
        const list = await printList()

        const put = await updatePrinted(id, { quantity: 1 }, userCookie)
        expect(put.status).toBe(403)
        expect(await put.json()).toEqual({ error: 'Keine Berechtigung' })
        expect((await deletePrinted(id, userCookie)).status).toBe(403)
        expect((await getList(list.id)).orders).toEqual(list.orders)
      })

      it('ändert die Menge und lässt den festgeschriebenen Preis unverändert', async () => {
        await orderOne(cola, 2, userCookie)
        const spendeId = await orderOne(spende, 1, userCookie)
        const colaOther = await orderOne(cola, 1, otherCookie)
        const list = await printList()
        const colaId = list.orders.find((o) => o.username === 'josh' && o.itemName === 'Cola')!.id

        await updateItem(cola.id, { name: 'Cola', priceCents: 999 })
        const res = await updatePrinted(colaId, { quantity: 5 })
        expect(res.status).toBe(200)
        const { order } = (await res.json()) as { order: Order }
        expect(order).toMatchObject({
          id: colaId,
          quantity: 5,
          priceCents: 150,
          listId: list.id,
          printedAt: list.printedAt,
          username: 'josh',
        })

        expect(
          (await getList(list.id)).orders.map((o) => [o.id, o.quantity, o.priceCents]),
        ).toEqual([
          [colaOther, 1, 150],
          [colaId, 5, 150],
          [spendeId, 1, null],
        ])
        expect((await lists())[0]).toMatchObject({
          orderCount: 3,
          totalCents: 5 * 150 + 150,
          unpricedCount: 1,
        })
        expect((await overview()).find((o) => o.id === colaId)).toMatchObject({
          quantity: 5,
          priceCents: 150,
        })
        expect(await balances()).toEqual([
          { userId: otherId, username: 'anna', totalCents: 150, unpricedCount: 0 },
          { userId, username: 'josh', totalCents: 750, unpricedCount: 1 },
        ])
      })

      it('löscht eine gedruckte Position', async () => {
        await orderOne(cola, 2, userCookie)
        await orderOne(spende, 1, otherCookie)
        const list = await printList()
        const colaId = list.orders.find((o) => o.itemName === 'Cola')!.id

        const res = await deletePrinted(colaId)
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ ok: true })

        expect((await getList(list.id)).orders.map((o) => o.itemName)).toEqual(['Spende'])
        expect(await overview()).toEqual([])
        expect(await balances()).toEqual([
          { userId: otherId, username: 'anna', totalCents: 0, unpricedCount: 1 },
        ])
        expect((await lists())[0]).toMatchObject({ orderCount: 1, totalCents: 0, unpricedCount: 1 })
        expect((await deletePrinted(colaId)).status).toBe(404)
      })

      it('lässt eine Liste ohne Positionen mit 0 Positionen bestehen', async () => {
        const a = await orderOne(cola, 2)
        const b = await orderOne(spende, 1)
        const list = await printList()
        expect((await deletePrinted(a)).status).toBe(200)
        expect((await deletePrinted(b)).status).toBe(200)

        expect(await lists()).toEqual([
          {
            id: list.id,
            printedAt: list.printedAt,
            printedByName: 'boss',
            orderCount: 0,
            totalCents: 0,
            unpricedCount: 0,
          },
        ])
        expect((await getList(list.id)).orders).toEqual([])
        expect(await balances()).toEqual([])
      })

      it('liefert für noch offene Positionen 404 und lässt sie unverändert', async () => {
        const id = await orderOne(cola, 2)
        for (const res of [await updatePrinted(id, { quantity: 3 }), await deletePrinted(id)]) {
          expect(res.status).toBe(404)
          expect(await res.json()).toEqual({ error: 'Bestellung nicht gefunden' })
        }
        expect((await openOrders()).map((o) => [o.id, o.quantity])).toEqual([[id, 2]])
      })

      it.each(['9999', 'abc', '0'])('liefert für unbekannte Position %s 404', async (id) => {
        for (const res of [await updatePrinted(id, { quantity: 1 }), await deletePrinted(id)]) {
          expect(res.status).toBe(404)
          expect(await res.json()).toEqual({ error: 'Bestellung nicht gefunden' })
        }
      })

      it.each([0, -1, 1000, 1.5, '2', null, undefined])(
        'lehnt die Menge %j mit 400 ab',
        async (quantity) => {
          const id = await orderOne(cola, 2)
          await printList()
          const res = await updatePrinted(id, { quantity })
          expect(res.status).toBe(400)
          expect(await res.json()).toEqual({ error: 'Menge muss zwischen 1 und 999 liegen' })
          expect((await overview())[0]!.quantity).toBe(2)
        },
      )
    })

    describe('Wer muss was zahlen', () => {
      it('summiert pro Empfänger über alle Listen', async () => {
        await orderOne(cola, 2, userCookie)
        await orderOne(spende, 1, userCookie, otherId)
        await printList()
        await orderOne(cola, 1, otherCookie, userId)
        await orderOne(cola, 3, userCookie, otherId)
        await printList()
        await orderOne(cola, 5, userCookie) // offen, zählt nicht

        expect(await balances()).toEqual([
          { userId: otherId, username: 'anna', totalCents: 450, unpricedCount: 1 },
          { userId, username: 'josh', totalCents: 450, unpricedCount: 0 },
        ])
      })

      it('liefert ohne gedruckte Positionen eine leere Liste', async () => {
        await orderOne(cola)
        expect(await balances()).toEqual([])
      })
    })

    describe('Testdaten zurücksetzen (Admin)', () => {
      const reset = (cookie?: string) => api('/api/admin/shop-data', { method: 'DELETE', cookie })

      const count = async (table: string) =>
        (await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>())!.n

      it('verlangt Login und Adminrechte', async () => {
        expect((await reset()).status).toBe(401)
        expect((await reset(userCookie)).status).toBe(403)
      })

      it('löscht Bestellungen und Listen, aber nie Benutzer oder Artikel', async () => {
        await orderOne(cola, 2)
        await printList()
        await orderOne(spende, 1, otherCookie)
        await orderOne(cola, 1, otherCookie)

        const res = await reset(adminCookie)
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ ok: true, deletedOrders: 3, deletedLists: 1 })
        expect(await count('shop_orders')).toBe(0)
        expect(await count('shop_lists')).toBe(0)
        expect(await count('shop_items')).toBe(2)
        expect(await count('users')).toBe(3)
      })

      it('funktioniert auch ohne Daten', async () => {
        const res = await reset(adminCookie)
        expect(await res.json()).toEqual({ ok: true, deletedOrders: 0, deletedLists: 0 })
      })
    })
  })
})
