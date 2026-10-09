import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, it } from 'vitest'
import { assertDeletable } from '../routes/admin'
import { api, createUser, login, me, resetDb } from './helpers'

type ListBody = {
  users: Array<{ id: number; username: string; isAdmin: boolean; createdAt: string }>
}

describe('/api/admin', () => {
  let bossId: number
  let joshId: number
  let adminCookie: string
  let userCookie: string

  const listUsers = async () =>
    (await (await api('/api/admin/users', { cookie: adminCookie })).json()) as ListBody

  const createViaApi = (body: unknown) =>
    api('/api/admin/users', { method: 'POST', cookie: adminCookie, body })

  const deleteViaApi = (id: number | string, cookie = adminCookie) =>
    api(`/api/admin/users/${id}`, { method: 'DELETE', cookie })

  const resetViaApi = (id: number | string, password: unknown) =>
    api(`/api/admin/users/${id}/password`, {
      method: 'POST',
      cookie: adminCookie,
      body: { password },
    })

  beforeEach(async () => {
    await resetDb()
    bossId = await createUser('boss', 'geheim123', true)
    joshId = await createUser('josh', 'geheim123')
    adminCookie = await login('boss', 'geheim123')
    userCookie = await login('josh', 'geheim123')
  })

  describe('Zugriff', () => {
    it('liefert ohne Login 401', async () => {
      const res = await api('/api/admin/users')
      expect(res.status).toBe(401)
    })

    it('liefert als normaler Benutzer 403', async () => {
      const res = await api('/api/admin/users', { cookie: userCookie })
      expect(res.status).toBe(403)
      expect(await res.json()).toEqual({ error: 'Keine Berechtigung' })
    })
  })

  describe('auflisten', () => {
    it('liefert alle Benutzer sortiert, ohne Hashes', async () => {
      const res = await api('/api/admin/users', { cookie: adminCookie })
      expect(res.status).toBe(200)
      const body = (await res.json()) as ListBody
      expect(body.users).toEqual([
        { id: bossId, username: 'boss', isAdmin: true, createdAt: expect.any(String) },
        { id: joshId, username: 'josh', isAdmin: false, createdAt: expect.any(String) },
      ])
      expect(JSON.stringify(body)).not.toMatch(/password|pbkdf2/)
    })
  })

  describe('anlegen', () => {
    it('legt Benutzer mit getrimmtem Namen an, der sich einloggen kann', async () => {
      const res = await createViaApi({ username: '  neu ', password: 'startpass1' })
      expect(res.status).toBe(201)
      expect(await res.json()).toEqual({
        user: { id: expect.any(Number), username: 'neu', isAdmin: false },
      })
      await expect(login('neu', 'startpass1')).resolves.toMatch(/^session=/)
    })

    it('lehnt doppelten Namen unabhängig von Groß-/Kleinschreibung mit 409 ab', async () => {
      const res = await createViaApi({ username: 'JOSH', password: 'startpass1' })
      expect(res.status).toBe(409)
      expect(await res.json()).toEqual({ error: 'Benutzername ist bereits vergeben' })
    })

    it('lehnt ungültigen Namen mit 400 ab', async () => {
      expect((await createViaApi({ username: 'x', password: 'startpass1' })).status).toBe(400)
    })

    it('lehnt zu kurzes Passwort mit 400 ab', async () => {
      expect((await createViaApi({ username: 'neu', password: 'kurz' })).status).toBe(400)
    })

    it('lehnt fehlende Felder mit 400 ab', async () => {
      expect((await createViaApi({})).status).toBe(400)
    })
  })

  describe('löschen', () => {
    it('löscht Benutzer samt Sessions', async () => {
      const res = await deleteViaApi(joshId)
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ ok: true })
      expect((await listUsers()).users.map((u) => u.username)).toEqual(['boss'])
      expect(await me(userCookie)).toBeNull()
      const left = await env.DB.prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?')
        .bind(joshId)
        .first<{ n: number }>()
      expect(left?.n).toBe(0)
    })

    it('verbietet das Löschen des eigenen Kontos', async () => {
      const res = await deleteViaApi(bossId)
      expect(res.status).toBe(403)
      expect(await res.json()).toEqual({ error: 'Du kannst dein eigenes Konto nicht löschen' })
    })

    it('erlaubt das Löschen eines anderen Admins', async () => {
      const boss2Id = await createUser('boss2', 'geheim123', true)
      expect((await deleteViaApi(boss2Id)).status).toBe(200)
    })

    it.each(['abc', '9999', '0', '-1', '1.5'])('liefert für id %s 404', async (id) => {
      const res = await deleteViaApi(id)
      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({ error: 'Benutzer nicht gefunden' })
    })

    it('verbietet normalen Benutzern das Löschen', async () => {
      expect((await deleteViaApi(bossId, userCookie)).status).toBe(403)
    })
  })

  describe('Passwort zurücksetzen', () => {
    it('setzt das Passwort und beendet alle Sessions des Benutzers', async () => {
      const res = await resetViaApi(joshId, 'neuespass1')
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ ok: true })
      expect(await me(userCookie)).toBeNull()
      await expect(login('josh', 'neuespass1')).resolves.toMatch(/^session=/)
      await expect(login('josh', 'geheim123')).rejects.toThrow()
    })

    it('lehnt zu kurzes Passwort mit 400 ab', async () => {
      expect((await resetViaApi(joshId, 'kurz')).status).toBe(400)
    })

    it('liefert für unbekannte id 404', async () => {
      expect((await resetViaApi(9999, 'neuespass1')).status).toBe(404)
    })
  })
})

describe('assertDeletable', () => {
  it('verbietet das Löschen des letzten Admins', () => {
    expect(() => assertDeletable({ id: 2, isAdmin: true }, 1, 1)).toThrow(
      'Der letzte Admin kann nicht gelöscht werden',
    )
  })

  it('verbietet das Löschen des eigenen Kontos', () => {
    expect(() => assertDeletable({ id: 1, isAdmin: true }, 1, 2)).toThrow(
      'Du kannst dein eigenes Konto nicht löschen',
    )
  })

  it('erlaubt das Löschen eines Admins, wenn weitere übrig bleiben', () => {
    expect(() => assertDeletable({ id: 2, isAdmin: true }, 1, 2)).not.toThrow()
  })

  it('erlaubt das Löschen normaler Benutzer', () => {
    expect(() => assertDeletable({ id: 2, isAdmin: false }, 1, 1)).not.toThrow()
  })
})
