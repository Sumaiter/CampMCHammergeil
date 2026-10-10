import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { requireAdmin } from '../middleware'
import { hashPassword } from '../lib/password'
import { deleteUserSessions } from '../lib/session'
import {
  HttpError,
  isUniqueError,
  normalizeUsername,
  parseId,
  readJson,
  validatePassword,
  validateUsername,
} from '../lib/validation'

type UserRow = { id: number; username: string; is_admin: number; created_at: string }

const NOT_FOUND = 'Benutzer nicht gefunden'

// Soft Delete: Die Zeile bleibt, damit Bestellungen und Listen den Namen weiter anzeigen können.
// Prüfung und Update in einem Statement, damit zwei Admins, die sich gleichzeitig gegenseitig
// löschen, nicht beide durchkommen. Das Passwort wird unbrauchbar (kein gültiges Hash-Format).
export async function deleteUserUnlessLastAdmin(db: D1Database, id: number): Promise<boolean> {
  const { meta } = await db
    .prepare(
      `UPDATE users SET deleted_at = datetime('now'), is_admin = 0, password_hash = '!deleted'
       WHERE id = ? AND deleted_at IS NULL
         AND (is_admin = 0
              OR (SELECT COUNT(*) FROM users WHERE is_admin = 1 AND deleted_at IS NULL) > 1)`,
    )
    .bind(id)
    .run()
  if (meta.changes === 0) return false
  await deleteUserSessions(db, id)
  return true
}

async function findUser(db: D1Database, rawId: string): Promise<{ id: number }> {
  const row = await db
    .prepare('SELECT id FROM users WHERE id = ? AND deleted_at IS NULL')
    .bind(parseId(rawId, NOT_FOUND))
    .first<{ id: number }>()
  if (!row) throw new HttpError(404, NOT_FOUND)
  return row
}

export const adminRoutes = new Hono<AppEnv>()

adminRoutes.use('*', requireAdmin)

adminRoutes.get('/users', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, username, is_admin, created_at FROM users WHERE deleted_at IS NULL ORDER BY username COLLATE NOCASE',
  ).all<UserRow>()
  return c.json({
    users: results.map((row) => ({
      id: row.id,
      username: row.username,
      isAdmin: row.is_admin === 1,
      createdAt: row.created_at,
    })),
  })
})

adminRoutes.post('/users', async (c) => {
  const body = await readJson<{ username: unknown; password: unknown; isAdmin: unknown }>(c)
  const username = normalizeUsername(body.username)
  validateUsername(username)
  const password = validatePassword(body.password)
  const isAdmin = body.isAdmin === true

  let row: { id: number } | null
  try {
    row = await c.env.DB.prepare(
      'INSERT INTO users (username, password_hash, is_admin, must_change_password) VALUES (?, ?, ?, 1) RETURNING id',
    )
      .bind(username, await hashPassword(password), isAdmin ? 1 : 0)
      .first<{ id: number }>()
  } catch (err) {
    if (isUniqueError(err)) {
      throw new HttpError(409, 'Benutzername ist bereits vergeben')
    }
    throw err
  }

  return c.json({ user: { id: row!.id, username, isAdmin } }, 201)
})

adminRoutes.delete('/users/:id', async (c) => {
  const target = await findUser(c.env.DB, c.req.param('id'))
  if (target.id === c.var.user!.id) {
    throw new HttpError(403, 'Du kannst dein eigenes Konto nicht löschen')
  }
  if (!(await deleteUserUnlessLastAdmin(c.env.DB, target.id))) {
    throw new HttpError(403, 'Der letzte Admin kann nicht gelöscht werden')
  }
  return c.json({ ok: true })
})

// Setzt die Testdaten zurück: alle Bestellungen und Listen, nie Benutzer oder Artikel.
adminRoutes.delete('/shop-data', async (c) => {
  const [orders, lists] = await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM shop_orders'),
    c.env.DB.prepare('DELETE FROM shop_lists'),
  ])
  return c.json({
    ok: true,
    deletedOrders: orders!.meta.changes,
    deletedLists: lists!.meta.changes,
  })
})

adminRoutes.post('/users/:id/password', async (c) => {
  const target = await findUser(c.env.DB, c.req.param('id'))
  const body = await readJson<{ password: unknown }>(c)
  const password = validatePassword(body.password)

  // Das vom Admin vergebene Passwort ist nur vorläufig – der Benutzer muss es selbst ändern.
  await c.env.DB.prepare(
    'UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?',
  )
    .bind(await hashPassword(password), target.id)
    .run()
  // Setzt ein Admin sein eigenes Passwort zurück, bleibt er in dieser Sitzung eingeloggt.
  const keep = target.id === c.var.user!.id ? c.var.sessionId! : undefined
  await deleteUserSessions(c.env.DB, target.id, keep)
  return c.json({ ok: true })
})
