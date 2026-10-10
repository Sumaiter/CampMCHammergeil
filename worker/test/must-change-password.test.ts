import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, it } from 'vitest'
import { api, createUser, login, me, resetDb } from './helpers'

const REQUIRED = { error: 'Du musst zuerst dein Passwort ändern', code: 'password_change_required' }

const flagOf = async (username: string) =>
  (await env.DB.prepare('SELECT must_change_password AS flag FROM users WHERE username = ?')
    .bind(username)
    .first<{ flag: number }>())!.flag

describe('Passwortänderung erzwingen', () => {
  let bossCookie: string

  beforeEach(async () => {
    await resetDb()
    await createUser('boss', 'geheim123', true)
    bossCookie = await login('boss', 'geheim123')
  })

  describe('Flag setzen und löschen', () => {
    it('ist bei normal angelegten Benutzern aus', async () => {
      await createUser('josh', 'geheim123')
      expect(await flagOf('josh')).toBe(0)
    })

    it('wird beim Anlegen durch einen Admin gesetzt', async () => {
      const res = await api('/api/admin/users', {
        method: 'POST',
        cookie: bossCookie,
        body: { username: 'neu', password: 'startpass1' },
      })
      expect(res.status).toBe(201)
      expect(await flagOf('neu')).toBe(1)
      expect(await me(await login('neu', 'startpass1'))).toMatchObject({ mustChangePassword: true })
    })

    it('wird beim Zurücksetzen durch einen Admin gesetzt', async () => {
      const joshId = await createUser('josh', 'geheim123')
      const res = await api(`/api/admin/users/${joshId}/password`, {
        method: 'POST',
        cookie: bossCookie,
        body: { password: 'neuespass1' },
      })
      expect(res.status).toBe(200)
      expect(await flagOf('josh')).toBe(1)
    })

    it('wird beim erfolgreichen Ändern des eigenen Passworts gelöscht', async () => {
      await createUser('josh', 'geheim123', false, true)
      const cookie = await login('josh', 'geheim123')
      const res = await api('/api/auth/password', {
        method: 'POST',
        cookie,
        body: { currentPassword: 'geheim123', newPassword: 'neuespass1' },
      })
      expect(res.status).toBe(200)
      expect(await flagOf('josh')).toBe(0)
      expect(await me(cookie)).toMatchObject({ mustChangePassword: false })
    })

    it('verlangt das aktuelle Passwort nicht', async () => {
      await createUser('josh', 'geheim123', false, true)
      const cookie = await login('josh', 'geheim123')
      const res = await api('/api/auth/password', {
        method: 'POST',
        cookie,
        body: { newPassword: 'neuespass1' },
      })
      expect(res.status).toBe(200)
      expect(await flagOf('josh')).toBe(0)
      await expect(login('josh', 'geheim123')).rejects.toThrow()
      await login('josh', 'neuespass1')
    })

    it('lehnt das unveränderte Passwort auch ohne aktuelles Passwort ab', async () => {
      await createUser('josh', 'geheim123', false, true)
      const cookie = await login('josh', 'geheim123')
      const res = await api('/api/auth/password', {
        method: 'POST',
        cookie,
        body: { newPassword: 'geheim123' },
      })
      expect(res.status).toBe(400)
      expect(await flagOf('josh')).toBe(1)
    })

    it('verlangt ein neues Passwort, das sich vom alten unterscheidet', async () => {
      await createUser('josh', 'geheim123', false, true)
      const cookie = await login('josh', 'geheim123')
      const res = await api('/api/auth/password', {
        method: 'POST',
        cookie,
        body: { currentPassword: 'geheim123', newPassword: 'geheim123' },
      })
      expect(res.status).toBe(400)
      expect(await flagOf('josh')).toBe(1)
    })
  })

  describe('Login-Antwort', () => {
    it('meldet mustChangePassword', async () => {
      await createUser('josh', 'geheim123', false, true)
      const res = await api('/api/auth/login', {
        method: 'POST',
        body: { username: 'josh', password: 'geheim123' },
      })
      expect(res.status).toBe(200)
      expect(((await res.json()) as { user: unknown }).user).toMatchObject({
        username: 'josh',
        mustChangePassword: true,
      })
    })
  })

  describe('Sperre in der Middleware', () => {
    let cookie: string

    beforeEach(async () => {
      await createUser('josh', 'geheim123', false, true)
      cookie = await login('josh', 'geheim123')
    })

    it.each([
      ['GET', '/api/admin/users'],
      ['POST', '/api/admin/users'],
      ['GET', '/api/irgendwas'],
      ['DELETE', '/api/admin/users/1'],
    ])('blockt %s %s mit 403 und Fehlercode', async (method, path) => {
      const res = await api(path, { method, cookie, body: method === 'GET' ? undefined : {} })
      expect(res.status).toBe(403)
      expect(await res.json()).toEqual(REQUIRED)
    })

    it('blockt auch Admins', async () => {
      await createUser('boss2', 'geheim123', true, true)
      const adminCookie = await login('boss2', 'geheim123')
      const res = await api('/api/admin/users', { cookie: adminCookie })
      expect(res.status).toBe(403)
      expect(await res.json()).toEqual(REQUIRED)
    })

    it('lässt me durch', async () => {
      expect(await me(cookie)).toMatchObject({ username: 'josh', mustChangePassword: true })
    })

    it('lässt Passwort ändern durch und gibt danach alles frei', async () => {
      const res = await api('/api/auth/password', {
        method: 'POST',
        cookie,
        body: { currentPassword: 'geheim123', newPassword: 'neuespass1' },
      })
      expect(res.status).toBe(200)
      // Jetzt keine Passwortsperre mehr, sondern nur noch die normale Rechteprüfung
      const after = await api('/api/admin/users', { cookie })
      expect(after.status).toBe(403)
      expect(await after.json()).toEqual({ error: 'Keine Berechtigung' })
    })

    it('lässt Logout durch', async () => {
      const res = await api('/api/auth/logout', { method: 'POST', cookie })
      expect(res.status).toBe(200)
      expect(await me(cookie)).toBeNull()
    })

    it('lässt Konto löschen durch', async () => {
      const res = await api('/api/auth/account', {
        method: 'DELETE',
        cookie,
        body: { password: 'geheim123' },
      })
      expect(res.status).toBe(200)
    })

    it('sperrt ohne Flag nichts', async () => {
      await createUser('frei', 'geheim123')
      const freeCookie = await login('frei', 'geheim123')
      expect((await api('/api/irgendwas', { cookie: freeCookie })).status).toBe(404)
    })
  })
})
