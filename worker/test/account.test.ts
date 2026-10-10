import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, it } from 'vitest'
import { api, createUser, login, me, resetDb } from './helpers'

const deleteAccount = (cookie: string | undefined, password: unknown) =>
  api('/api/auth/account', { method: 'DELETE', cookie, body: { password } })

const userCount = async () =>
  (await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first<{ n: number }>())!.n

describe('DELETE /api/auth/account', () => {
  let joshId: number

  beforeEach(async () => {
    await resetDb()
    await createUser('boss', 'geheim123', true)
    joshId = await createUser('josh', 'geheim123')
  })

  it('liefert ohne Login 401', async () => {
    expect((await deleteAccount(undefined, 'geheim123')).status).toBe(401)
  })

  it.each([['falsch123'], [''], [undefined], [42]])(
    'lehnt falsches Passwort (%j) mit 400 ab und lässt alles bestehen',
    async (password) => {
      const cookie = await login('josh', 'geheim123')
      const res = await deleteAccount(cookie, password)
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'Passwort ist falsch' })
      expect(await me(cookie)).toMatchObject({ id: joshId })
    },
  )

  it('sperrt Benutzer samt allen Sessions und das Cookie, behält aber die Zeile', async () => {
    const cookie = await login('josh', 'geheim123')
    await login('josh', 'geheim123')
    const res = await deleteAccount(cookie, 'geheim123')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(res.headers.get('set-cookie')).toMatch(/^session=;.*Max-Age=0/)
    expect(await me(cookie)).toBeNull()
    const left = await env.DB.prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?')
      .bind(joshId)
      .first<{ n: number }>()
    expect(left?.n).toBe(0)
    expect(await userCount()).toBe(2)
    await expect(login('josh', 'geheim123')).rejects.toThrow()
    const row = await env.DB.prepare('SELECT deleted_at, is_admin FROM users WHERE id = ?')
      .bind(joshId)
      .first<{ deleted_at: string | null; is_admin: number }>()
    expect(row?.deleted_at).toBeTruthy()
    expect(row?.is_admin).toBe(0)
  })

  it('behält die Bestellungen des gelöschten Benutzers', async () => {
    const item = await env.DB.prepare(
      "INSERT INTO shop_items (name) VALUES ('Cola') RETURNING id",
    ).first<{ id: number }>()
    await env.DB.prepare('INSERT INTO shop_orders (user_id, item_id, quantity) VALUES (?, ?, 2)')
      .bind(joshId, item!.id)
      .run()
    const cookie = await login('josh', 'geheim123')
    expect((await deleteAccount(cookie, 'geheim123')).status).toBe(200)
    const orders = await env.DB.prepare('SELECT quantity FROM shop_orders WHERE user_id = ?')
      .bind(joshId)
      .all<{ quantity: number }>()
    expect(orders.results).toEqual([{ quantity: 2 }])
  })

  it('erlaubt einem Admin das Löschen, solange ein weiterer Admin bleibt', async () => {
    await createUser('boss2', 'geheim123', true)
    const cookie = await login('boss2', 'geheim123')
    expect((await deleteAccount(cookie, 'geheim123')).status).toBe(200)
    expect(await userCount()).toBe(3)
  })

  it('zählt gelöschte Admins beim Schutz des letzten Admins nicht mit', async () => {
    await createUser('boss2', 'geheim123', true)
    const cookie2 = await login('boss2', 'geheim123')
    expect((await deleteAccount(cookie2, 'geheim123')).status).toBe(200)
    const cookie = await login('boss', 'geheim123')
    expect((await deleteAccount(cookie, 'geheim123')).status).toBe(409)
  })

  it('schützt den letzten Admin mit 409', async () => {
    const cookie = await login('boss', 'geheim123')
    const res = await deleteAccount(cookie, 'geheim123')
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'Der letzte Admin kann sein Konto nicht löschen' })
    expect(await me(cookie)).toMatchObject({ username: 'boss' })
    expect(await userCount()).toBe(2)
  })
})
