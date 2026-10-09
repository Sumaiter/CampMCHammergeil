import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, it } from 'vitest'
import { api, createUser, login, me, resetDb } from './helpers'

const LOGIN_ERROR = { error: 'Benutzername oder Passwort falsch' }

const postLogin = (body: unknown, ip?: string) =>
  api('/api/auth/login', { method: 'POST', body, ip })

const changePassword = (cookie: string, currentPassword: string, newPassword: string) =>
  api('/api/auth/password', { method: 'POST', cookie, body: { currentPassword, newPassword } })

describe('/api/auth', () => {
  let joshId: number

  beforeEach(async () => {
    await resetDb()
    joshId = await createUser('josh', 'geheim123')
  })

  describe('login', () => {
    it('setzt mit richtigen Daten das Cookie und liefert den User', async () => {
      const res = await postLogin({ username: 'josh', password: 'geheim123' })
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ user: { id: joshId, username: 'josh', isAdmin: false } })
      const cookie = res.headers.get('set-cookie')!
      expect(cookie).toMatch(/^session=[^;]+;/)
      for (const attr of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/', 'Max-Age=2592000']) {
        expect(cookie).toContain(attr)
      }
    })

    it('ist case-insensitiv und trimmt den Benutzernamen', async () => {
      const res = await postLogin({ username: '  JOSH ', password: 'geheim123' })
      expect(res.status).toBe(200)
      expect(((await res.json()) as { user: { username: string } }).user.username).toBe('josh')
    })

    it.each([
      [{ username: 'josh', password: 'falsch123' }],
      [{ username: 'niemand', password: 'geheim123' }],
      [{}],
      [{ username: 5, password: ['x'] }],
    ])('liefert bei Fehlern immer dieselbe Meldung (%j)', async (body) => {
      const res = await postLogin(body)
      expect(res.status).toBe(401)
      expect(await res.json()).toEqual(LOGIN_ERROR)
    })

    it('liefert bei kaputtem JSON 400', async () => {
      const res = await api('/api/auth/login', { method: 'POST', body: '{' })
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'Ungültige Anfrage' })
    })

    it('blockt den 11. Versuch derselben IP mit 429', async () => {
      for (let i = 0; i < 10; i++) {
        const res = await postLogin({ username: 'josh', password: 'falsch123' }, '10.0.0.1')
        expect(res.status).toBe(401)
      }
      const res = await postLogin({ username: 'josh', password: 'geheim123' }, '10.0.0.1')
      expect(res.status).toBe(429)
      expect(await res.json()).toEqual({
        error: 'Zu viele Login-Versuche. Bitte warte eine Minute.',
      })
    })
  })

  describe('me', () => {
    it('liefert ohne Cookie user null', async () => {
      expect(await me()).toBeNull()
    })

    it('liefert mit Cookie den User', async () => {
      const cookie = await login('josh', 'geheim123')
      expect(await me(cookie)).toEqual({ id: joshId, username: 'josh', isAdmin: false })
    })

    it('liefert bei abgelaufener Session user null', async () => {
      const cookie = await login('josh', 'geheim123')
      await env.DB.prepare('UPDATE sessions SET expires_at = 1').run()
      expect(await me(cookie)).toBeNull()
    })

    it('liefert bei unbekanntem Token user null', async () => {
      expect(await me('session=quatsch')).toBeNull()
    })
  })

  describe('logout', () => {
    it('löscht Session und Cookie', async () => {
      const cookie = await login('josh', 'geheim123')
      const res = await api('/api/auth/logout', { method: 'POST', cookie })
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ ok: true })
      expect(res.headers.get('set-cookie')).toMatch(/^session=;.*Max-Age=0/)
      expect(await me(cookie)).toBeNull()
    })

    it('liefert ohne Login 401', async () => {
      const res = await api('/api/auth/logout', { method: 'POST' })
      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({ error: 'Nicht eingeloggt' })
    })
  })

  describe('password', () => {
    it('liefert ohne Login 401', async () => {
      const res = await api('/api/auth/password', {
        method: 'POST',
        body: { currentPassword: 'geheim123', newPassword: 'neuespass1' },
      })
      expect(res.status).toBe(401)
    })

    it('lehnt falsches aktuelles Passwort mit 400 ab, ohne die Session zu beenden', async () => {
      const cookie = await login('josh', 'geheim123')
      const res = await changePassword(cookie, 'falsch123', 'neuespass1')
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'Aktuelles Passwort ist falsch' })
      expect(await me(cookie)).toEqual({ id: joshId, username: 'josh', isAdmin: false })
    })

    it('lehnt zu kurzes neues Passwort mit 400 ab', async () => {
      const cookie = await login('josh', 'geheim123')
      const res = await changePassword(cookie, 'geheim123', 'kurz')
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'Passwort muss 8–128 Zeichen lang sein' })
    })

    it('löscht andere Sessions, behält die aktuelle und das neue Passwort gilt', async () => {
      const a = await login('josh', 'geheim123')
      const b = await login('josh', 'geheim123')
      const res = await changePassword(a, 'geheim123', 'neuespass1')
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ ok: true })
      expect(await me(a)).toEqual({ id: joshId, username: 'josh', isAdmin: false })
      expect(await me(b)).toBeNull()
      expect((await postLogin({ username: 'josh', password: 'neuespass1' })).status).toBe(200)
      expect((await postLogin({ username: 'josh', password: 'geheim123' })).status).toBe(401)
    })
  })
})
