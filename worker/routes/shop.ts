import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { requireAdmin, requireUser } from '../middleware'
import { HttpError, readJson } from '../lib/validation'

type ItemRow = { id: number; name: string; price_cents: number | null }
type OrderRow = {
  id: number
  item_name: string
  price_cents: number | null
  quantity: number
  created_at: string
}

const NOT_FOUND = 'Artikel nicht gefunden'
const DUPLICATE = 'Artikel existiert bereits'
const MAX_PRICE_CENTS = 1_000_000
const MAX_QUANTITY = 999

const toItem = (row: ItemRow) => ({ id: row.id, name: row.name, priceCents: row.price_cents })

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

function isUniqueError(err: unknown): boolean {
  return err instanceof Error && /UNIQUE/.test(err.message)
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
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, NOT_FOUND)
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

shopRoutes.post('/orders', requireUser, async (c) => {
  const body = await readJson<{ items: unknown }>(c)
  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw new HttpError(400, 'Keine Artikel ausgewählt')
  }

  const lines: Array<{ itemId: number; quantity: number }> = []
  for (const entry of body.items as unknown[]) {
    const { itemId, quantity } = (entry ?? {}) as { itemId?: unknown; quantity?: unknown }
    if (typeof itemId !== 'number' || !Number.isInteger(itemId) || itemId <= 0) {
      throw new HttpError(400, 'Unbekannter Artikel')
    }
    if (
      typeof quantity !== 'number' ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_QUANTITY
    ) {
      throw new HttpError(400, `Menge muss zwischen 1 und ${MAX_QUANTITY} liegen`)
    }
    lines.push({ itemId, quantity })
  }
  if (new Set(lines.map((l) => l.itemId)).size !== lines.length) {
    throw new HttpError(400, 'Artikel doppelt ausgewählt')
  }

  const db = c.env.DB
  const placeholders = lines.map(() => '?').join(', ')
  const { results: found } = await db
    .prepare(`SELECT id FROM shop_items WHERE id IN (${placeholders})`)
    .bind(...lines.map((l) => l.itemId))
    .all<{ id: number }>()
  if (found.length !== lines.length) throw new HttpError(400, 'Unbekannter Artikel')

  // Gleicher Zeitstempel für alle Zeilen, damit sie als eine Bestellung erkennbar bleiben.
  const createdAt = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const userId = c.var.user!.id
  await db.batch(
    lines.map((l) =>
      db
        .prepare(
          'INSERT INTO shop_orders (user_id, item_id, quantity, created_at) VALUES (?, ?, ?, ?)',
        )
        .bind(userId, l.itemId, l.quantity, createdAt),
    ),
  )
  return c.json({ ok: true }, 201)
})

shopRoutes.get('/orders', requireUser, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT o.id, i.name AS item_name, i.price_cents, o.quantity, o.created_at
       FROM shop_orders o JOIN shop_items i ON i.id = o.item_id
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC, o.id`,
  )
    .bind(c.var.user!.id)
    .all<OrderRow>()
  return c.json({
    orders: results.map((row) => ({
      id: row.id,
      itemName: row.item_name,
      priceCents: row.price_cents,
      quantity: row.quantity,
      createdAt: row.created_at,
    })),
  })
})
