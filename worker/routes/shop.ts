import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { requireAdmin, requireUser } from '../middleware'
import { HttpError, readJson } from '../lib/validation'

type ItemRow = { id: number; name: string; price_cents: number | null }
type OrderRow = {
  id: number
  item_id: number
  item_name: string
  price_cents: number | null
  quantity: number
  created_at: string
  user_id: number
  username: string
  ordered_by_user_id: number | null
  ordered_by_name: string | null
  list_id: number | null
  printed_at: string | null
}
type ListRow = { id: number; printed_at: string; printed_by_name: string | null }
type ListSummaryRow = ListRow & { order_count: number; total_cents: number; unpriced_count: number }
type BalanceRow = { user_id: number; username: string; total_cents: number; unpriced_count: number }

const NOT_FOUND = 'Artikel nicht gefunden'
const DUPLICATE = 'Artikel existiert bereits'
const ORDER_NOT_FOUND = 'Bestellung nicht gefunden'
const ALREADY_PRINTED = 'Liste wurde bereits gedruckt'
const LIST_NOT_FOUND = 'Liste nicht gefunden'
const NO_OPEN_ORDERS = 'Keine offenen Bestellungen'
const MAX_PRICE_CENTS = 1_000_000
const MAX_QUANTITY = 999

// Gemeinsame Abfrage für Bestellpositionen. Preis: beim Drucken festgeschrieben, sonst aktueller Artikelpreis.
const ORDER_SELECT = `
  SELECT o.id, o.item_id, i.name AS item_name, COALESCE(o.price_cents, i.price_cents) AS price_cents,
         o.quantity, o.created_at, o.user_id, u.username, o.ordered_by_user_id,
         ob.username AS ordered_by_name, o.list_id, l.printed_at
    FROM shop_orders o
    JOIN shop_items i ON i.id = o.item_id
    JOIN users u ON u.id = o.user_id
    LEFT JOIN users ob ON ob.id = o.ordered_by_user_id
    LEFT JOIN shop_lists l ON l.id = o.list_id`

// Sortierung für Listenansichten: nach Empfänger, dann Artikel.
const BY_RECIPIENT = 'ORDER BY u.username COLLATE NOCASE, i.name COLLATE NOCASE, o.id'

const toItem = (row: ItemRow) => ({ id: row.id, name: row.name, priceCents: row.price_cents })

const toOrder = (row: OrderRow) => ({
  id: row.id,
  itemId: row.item_id,
  itemName: row.item_name,
  priceCents: row.price_cents,
  quantity: row.quantity,
  createdAt: row.created_at,
  userId: row.user_id,
  username: row.username,
  orderedById: row.ordered_by_user_id,
  orderedByName: row.ordered_by_name,
  listId: row.list_id,
  printedAt: row.printed_at,
})

function validateName(value: unknown): string {
  const name = typeof value === 'string' ? value.trim() : ''
  if (name.length < 1 || name.length > 100) {
    throw new HttpError(400, 'Name muss 1–100 Zeichen lang sein')
  }
  return name
}

// Fehlender Preis oder null bedeutet „kein Preis“.
function validatePrice(value: unknown): number | null {
  if (value === undefined || value === null) return null
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > MAX_PRICE_CENTS
  ) {
    throw new HttpError(400, 'Preis muss zwischen 0 und 10.000 € liegen')
  }
  return value
}

function validateQuantity(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > MAX_QUANTITY) {
    throw new HttpError(400, `Menge muss zwischen 1 und ${MAX_QUANTITY} liegen`)
  }
  return value
}

const isPositiveInt = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0

function parseId(value: string, notFound: string): number {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, notFound)
  return id
}

function isUniqueError(err: unknown): boolean {
  return err instanceof Error && /UNIQUE/.test(err.message)
}

// Wirft 404, wenn die Position fehlt oder den Benutzer nichts angeht, und 409, wenn sie schon gedruckt ist.
async function assertEditableOrder(db: D1Database, id: number, userId: number): Promise<void> {
  const row = await db
    .prepare('SELECT user_id, ordered_by_user_id, list_id FROM shop_orders WHERE id = ?')
    .bind(id)
    .first<{ user_id: number; ordered_by_user_id: number | null; list_id: number | null }>()
  if (!row || (row.user_id !== userId && row.ordered_by_user_id !== userId)) {
    throw new HttpError(404, ORDER_NOT_FOUND)
  }
  if (row.list_id !== null) throw new HttpError(409, ALREADY_PRINTED)
}

async function loadListDetail(db: D1Database, id: number) {
  const list = await db
    .prepare(
      `SELECT l.id, l.printed_at, pb.username AS printed_by_name
         FROM shop_lists l LEFT JOIN users pb ON pb.id = l.printed_by
        WHERE l.id = ?`,
    )
    .bind(id)
    .first<ListRow>()
  if (!list) throw new HttpError(404, LIST_NOT_FOUND)
  const { results } = await db
    .prepare(`${ORDER_SELECT} WHERE o.list_id = ? ${BY_RECIPIENT}`)
    .bind(id)
    .all<OrderRow>()
  return {
    id: list.id,
    printedAt: list.printed_at,
    printedByName: list.printed_by_name,
    orders: results.map(toOrder),
  }
}

export const shopRoutes = new Hono<AppEnv>()

shopRoutes.get('/items', requireUser, async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, name, price_cents FROM shop_items ORDER BY name COLLATE NOCASE',
  ).all<ItemRow>()
  return c.json({ items: results.map(toItem) })
})

shopRoutes.post('/items', requireAdmin, async (c) => {
  const body = await readJson<{ name: unknown; priceCents: unknown }>(c)
  const name = validateName(body.name)
  const priceCents = validatePrice(body.priceCents)

  let row: ItemRow | null
  try {
    row = await c.env.DB.prepare(
      'INSERT INTO shop_items (name, price_cents) VALUES (?, ?) RETURNING id, name, price_cents',
    )
      .bind(name, priceCents)
      .first<ItemRow>()
  } catch (err) {
    if (isUniqueError(err)) throw new HttpError(409, DUPLICATE)
    throw err
  }
  return c.json({ item: toItem(row!) }, 201)
})

shopRoutes.put('/items/:id', requireAdmin, async (c) => {
  const id = parseId(c.req.param('id'), NOT_FOUND)
  const body = await readJson<{ name: unknown; priceCents: unknown }>(c)
  const name = validateName(body.name)
  const priceCents = validatePrice(body.priceCents)

  let row: ItemRow | null
  try {
    row = await c.env.DB.prepare(
      'UPDATE shop_items SET name = ?, price_cents = ? WHERE id = ? RETURNING id, name, price_cents',
    )
      .bind(name, priceCents, id)
      .first<ItemRow>()
  } catch (err) {
    if (isUniqueError(err)) throw new HttpError(409, DUPLICATE)
    throw err
  }
  if (!row) throw new HttpError(404, NOT_FOUND)
  return c.json({ item: toItem(row) })
})

shopRoutes.get('/users', requireUser, async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, username FROM users ORDER BY username COLLATE NOCASE',
  ).all<{ id: number; username: string }>()
  return c.json({ users: results })
})

shopRoutes.post('/orders', requireUser, async (c) => {
  const body = await readJson<{ forUserId: unknown; items: unknown }>(c)
  const me = c.var.user!.id
  const db = c.env.DB

  // Ohne forUserId bestellt man für sich selbst.
  let recipientId = me
  if (body.forUserId !== undefined && body.forUserId !== null) {
    const exists =
      isPositiveInt(body.forUserId) &&
      (await db.prepare('SELECT 1 FROM users WHERE id = ?').bind(body.forUserId).first())
    if (!exists) throw new HttpError(400, 'Unbekannter Benutzer')
    recipientId = body.forUserId as number
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw new HttpError(400, 'Keine Artikel ausgewählt')
  }

  const lines: Array<{ itemId: number; quantity: number }> = []
  for (const entry of body.items as unknown[]) {
    const { itemId, quantity } = (entry ?? {}) as { itemId?: unknown; quantity?: unknown }
    if (!isPositiveInt(itemId)) throw new HttpError(400, 'Unbekannter Artikel')
    lines.push({ itemId, quantity: validateQuantity(quantity) })
  }
  if (new Set(lines.map((l) => l.itemId)).size !== lines.length) {
    throw new HttpError(400, 'Artikel doppelt ausgewählt')
  }

  const placeholders = lines.map(() => '?').join(', ')
  const { results: found } = await db
    .prepare(`SELECT id FROM shop_items WHERE id IN (${placeholders})`)
    .bind(...lines.map((l) => l.itemId))
    .all<{ id: number }>()
  if (found.length !== lines.length) throw new HttpError(400, 'Unbekannter Artikel')

  // Gleicher Zeitstempel für alle Zeilen, damit sie als eine Bestellung erkennbar bleiben.
  const createdAt = new Date().toISOString().slice(0, 19).replace('T', ' ')
  await db.batch(
    lines.map((l) =>
      db
        .prepare(
          `INSERT INTO shop_orders (user_id, ordered_by_user_id, item_id, quantity, created_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(recipientId, me, l.itemId, l.quantity, createdAt),
    ),
  )
  return c.json({ ok: true }, 201)
})

// Offene Positionen, bei denen ich Empfänger oder Besteller bin.
shopRoutes.get('/orders', requireUser, async (c) => {
  const me = c.var.user!.id
  const { results } = await c.env.DB.prepare(
    `${ORDER_SELECT}
      WHERE o.list_id IS NULL AND (o.user_id = ? OR o.ordered_by_user_id = ?)
      ORDER BY o.created_at DESC, o.id`,
  )
    .bind(me, me)
    .all<OrderRow>()
  return c.json({ orders: results.map(toOrder) })
})

// Die Bedingungen stecken auch im UPDATE/DELETE selbst, damit ein gleichzeitiger Druck nicht durchrutscht.
shopRoutes.put('/orders/:id', requireUser, async (c) => {
  const id = parseId(c.req.param('id'), ORDER_NOT_FOUND)
  const me = c.var.user!.id
  const db = c.env.DB
  await assertEditableOrder(db, id, me)
  const body = await readJson<{ quantity: unknown }>(c)
  const quantity = validateQuantity(body.quantity)

  const { meta } = await db
    .prepare(
      `UPDATE shop_orders SET quantity = ?
        WHERE id = ? AND list_id IS NULL AND (user_id = ? OR ordered_by_user_id = ?)`,
    )
    .bind(quantity, id, me, me)
    .run()
  if (meta.changes === 0) {
    await assertEditableOrder(db, id, me)
    throw new HttpError(409, ALREADY_PRINTED)
  }
  const row = await db.prepare(`${ORDER_SELECT} WHERE o.id = ?`).bind(id).first<OrderRow>()
  return c.json({ order: toOrder(row!) })
})

shopRoutes.delete('/orders/:id', requireUser, async (c) => {
  const id = parseId(c.req.param('id'), ORDER_NOT_FOUND)
  const me = c.var.user!.id
  const db = c.env.DB
  await assertEditableOrder(db, id, me)

  const { meta } = await db
    .prepare(
      `DELETE FROM shop_orders
        WHERE id = ? AND list_id IS NULL AND (user_id = ? OR ordered_by_user_id = ?)`,
    )
    .bind(id, me, me)
    .run()
  if (meta.changes === 0) {
    await assertEditableOrder(db, id, me)
    throw new HttpError(409, ALREADY_PRINTED)
  }
  return c.json({ ok: true })
})

// Admin-Korrektur gedruckter Positionen; der festgeschriebene Preis (price_cents) bleibt unberührt.
shopRoutes.put('/printed-orders/:id', requireAdmin, async (c) => {
  const id = parseId(c.req.param('id'), ORDER_NOT_FOUND)
  const body = await readJson<{ quantity: unknown }>(c)
  const quantity = validateQuantity(body.quantity)
  const db = c.env.DB

  const { meta } = await db
    .prepare('UPDATE shop_orders SET quantity = ? WHERE id = ? AND list_id IS NOT NULL')
    .bind(quantity, id)
    .run()
  if (meta.changes === 0) throw new HttpError(404, ORDER_NOT_FOUND)
  const row = await db.prepare(`${ORDER_SELECT} WHERE o.id = ?`).bind(id).first<OrderRow>()
  return c.json({ order: toOrder(row!) })
})

shopRoutes.delete('/printed-orders/:id', requireAdmin, async (c) => {
  const id = parseId(c.req.param('id'), ORDER_NOT_FOUND)
  const { meta } = await c.env.DB.prepare(
    'DELETE FROM shop_orders WHERE id = ? AND list_id IS NOT NULL',
  )
    .bind(id)
    .run()
  if (meta.changes === 0) throw new HttpError(404, ORDER_NOT_FOUND)
  return c.json({ ok: true })
})

shopRoutes.get('/open-orders', requireAdmin, async (c) => {
  const { results } = await c.env.DB.prepare(
    `${ORDER_SELECT} WHERE o.list_id IS NULL ${BY_RECIPIENT}`,
  ).all<OrderRow>()
  return c.json({ orders: results.map(toOrder) })
})

shopRoutes.post('/lists', requireAdmin, async (c) => {
  const db = c.env.DB
  const open = await db.prepare('SELECT 1 FROM shop_orders WHERE list_id IS NULL LIMIT 1').first()
  if (!open) throw new HttpError(400, NO_OPEN_ORDERS)

  // Ein Batch = eine Transaktion: MAX(id) ist die eben angelegte Liste. Positionen, die danach
  // eintreffen, bleiben offen.
  const [inserted, assigned] = await db.batch<{ id: number }>([
    db.prepare('INSERT INTO shop_lists (printed_by) VALUES (?) RETURNING id').bind(c.var.user!.id),
    db.prepare(
      `UPDATE shop_orders
          SET list_id = (SELECT MAX(id) FROM shop_lists),
              price_cents = (SELECT price_cents FROM shop_items WHERE id = shop_orders.item_id)
        WHERE list_id IS NULL`,
    ),
  ])
  const listId = inserted!.results[0]!.id

  // Wurden alle Positionen zwischen Prüfung und Batch gelöscht, keine leere Liste stehen lassen.
  if (assigned!.meta.changes === 0) {
    await db.prepare('DELETE FROM shop_lists WHERE id = ?').bind(listId).run()
    throw new HttpError(400, NO_OPEN_ORDERS)
  }
  return c.json({ list: await loadListDetail(db, listId) }, 201)
})

shopRoutes.get('/lists', requireAdmin, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT l.id, l.printed_at, pb.username AS printed_by_name,
            COUNT(o.id) AS order_count,
            COALESCE(SUM(COALESCE(o.price_cents, i.price_cents) * o.quantity), 0) AS total_cents,
            COUNT(o.id) - COUNT(COALESCE(o.price_cents, i.price_cents)) AS unpriced_count
       FROM shop_lists l
       LEFT JOIN users pb ON pb.id = l.printed_by
       LEFT JOIN shop_orders o ON o.list_id = l.id
       LEFT JOIN shop_items i ON i.id = o.item_id
      GROUP BY l.id
      ORDER BY l.printed_at DESC, l.id DESC`,
  ).all<ListSummaryRow>()
  return c.json({
    lists: results.map((row) => ({
      id: row.id,
      printedAt: row.printed_at,
      printedByName: row.printed_by_name,
      orderCount: row.order_count,
      totalCents: row.total_cents,
      unpricedCount: row.unpriced_count,
    })),
  })
})

shopRoutes.get('/lists/:id', requireAdmin, async (c) => {
  const id = parseId(c.req.param('id'), LIST_NOT_FOUND)
  return c.json({ list: await loadListDetail(c.env.DB, id) })
})

// Gedruckte Positionen eines Benutzers (Empfänger oder Besteller); fremde Benutzer nur für Admins.
shopRoutes.get('/overview', requireUser, async (c) => {
  const user = c.var.user!
  const param = c.req.query('userId')
  let userId = user.id
  if (param !== undefined && param !== '') {
    userId = Number(param)
    if (!isPositiveInt(userId)) throw new HttpError(400, 'Ungültige Anfrage')
    if (userId !== user.id && !user.isAdmin) throw new HttpError(403, 'Keine Berechtigung')
  }
  const { results } = await c.env.DB.prepare(
    `${ORDER_SELECT}
      WHERE o.list_id IS NOT NULL AND (o.user_id = ? OR o.ordered_by_user_id = ?)
      ORDER BY l.printed_at DESC, o.list_id DESC, i.name COLLATE NOCASE, o.id`,
  )
    .bind(userId, userId)
    .all<OrderRow>()
  return c.json({ orders: results.map(toOrder) })
})

// Wer muss was zahlen: Summe pro Empfänger über alle gedruckten Listen.
shopRoutes.get('/balances', requireAdmin, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT o.user_id, u.username,
            COALESCE(SUM(COALESCE(o.price_cents, i.price_cents) * o.quantity), 0) AS total_cents,
            COUNT(*) - COUNT(COALESCE(o.price_cents, i.price_cents)) AS unpriced_count
       FROM shop_orders o
       JOIN users u ON u.id = o.user_id
       JOIN shop_items i ON i.id = o.item_id
      WHERE o.list_id IS NOT NULL
      GROUP BY o.user_id
      ORDER BY u.username COLLATE NOCASE`,
  ).all<BalanceRow>()
  return c.json({
    balances: results.map((row) => ({
      userId: row.user_id,
      username: row.username,
      totalCents: row.total_cents,
      unpricedCount: row.unpriced_count,
    })),
  })
})
