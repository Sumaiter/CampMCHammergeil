import { Hono } from 'hono'
import { deleteCookie, setCookie } from 'hono/cookie'
import type { AppEnv } from '../types'
import { requireUser } from '../middleware'
import { hashPassword, verifyPassword } from '../lib/password'
import {
  createSession,
  deleteSession,
  deleteUserSessions,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
} from '../lib/session'
import { HttpError, normalizeUsername, readJson, validatePassword } from '../lib/validation'

const LOGIN_FAILED = 'Benutzername oder Passwort falsch'

const COOKIE_OPTIONS = { httpOnly: true, secure: true, sameSite: 'Lax', path: '/' } as const

// Wird bei unbekanntem Benutzer geprüft, damit die Antwortzeit nichts über existierende Namen verrät.
let dummyHash: Promise<string> | undefined
const getDummyHash = () => (dummyHash ??= hashPassword('dummy-password'))

type UserRow = { id: number; username: string; password_hash: string; is_admin: number }

export const authRoutes = new Hono<AppEnv>()

authRoutes.post('/login', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
  const { success } = await c.env.LOGIN_LIMITER.limit({ key: ip })
  if (!success) throw new HttpError(429, 'Zu viele Login-Versuche. Bitte warte eine Minute.')

  const body = await readJson<{ username: unknown; password: unknown }>(c)
  const username = normalizeUsername(body.username)
  const password = typeof body.password === 'string' ? body.password : ''

  const row = username
    ? await c.env.DB.prepare(
        'SELECT id, username, password_hash, is_admin FROM users WHERE username = ?',
      )
        .bind(username)
        .first<UserRow>()
    : null

  const valid = await verifyPassword(password, row?.password_hash ?? (await getDummyHash()))
  if (!row || !valid) throw new HttpError(401, LOGIN_FAILED)

  const { token } = await createSession(c.env.DB, row.id)
  setCookie(c, SESSION_COOKIE, token, { ...COOKIE_OPTIONS, maxAge: SESSION_TTL_SECONDS })
  return c.json({ user: { id: row.id, username: row.username, isAdmin: row.is_admin === 1 } })
})

authRoutes.post('/logout', requireUser, async (c) => {
  await deleteSession(c.env.DB, c.var.sessionId!)
  deleteCookie(c, SESSION_COOKIE, COOKIE_OPTIONS)
  return c.json({ ok: true })
})

authRoutes.get('/me', (c) => c.json({ user: c.var.user }))

authRoutes.post('/password', requireUser, async (c) => {
  const user = c.var.user!
  const body = await readJson<{ currentPassword: unknown; newPassword: unknown }>(c)

  const row = await c.env.DB.prepare('SELECT password_hash FROM users WHERE id = ?')
    .bind(user.id)
    .first<{ password_hash: string }>()
  const current = typeof body.currentPassword === 'string' ? body.currentPassword : ''
  if (!row || !(await verifyPassword(current, row.password_hash))) {
    throw new HttpError(400, 'Aktuelles Passwort ist falsch')
  }

  const newPassword = validatePassword(body.newPassword)
  await c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .bind(await hashPassword(newPassword), user.id)
    .run()
  await deleteUserSessions(c.env.DB, user.id, c.var.sessionId!)
  return c.json({ ok: true })
})
