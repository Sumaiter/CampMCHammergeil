import { Hono } from 'hono'
import { deleteCookie, setCookie } from 'hono/cookie'
import type { AppEnv, User } from '../types'
import { requireUser } from '../middleware'
import { deleteUserUnlessLastAdmin } from './admin'
import { hashPassword, verifyPassword } from '../lib/password'
import { countPasswordAttempt, resetPasswordAttempts } from '../lib/passwordAttempts'
import {
  createSession,
  deleteSession,
  deleteUserSessions,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  toUser,
} from '../lib/session'
import { asText, HttpError, normalizeUsername, readJson, validatePassword } from '../lib/validation'

const LOGIN_FAILED = 'Benutzername oder Passwort falsch'

const COOKIE_OPTIONS = { httpOnly: true, secure: true, sameSite: 'Lax', path: '/' } as const

// Wird bei unbekanntem Benutzer geprüft, damit die Antwortzeit nichts über existierende Namen verrät.
let dummyHash: Promise<string> | undefined
const getDummyHash = () => (dummyHash ??= hashPassword('dummy-password'))

type UserRow = {
  id: number
  username: string
  password_hash: string
  is_admin: number
  must_change_password: number
}

async function checkPassword(db: D1Database, userId: number, password: string): Promise<boolean> {
  const row = await db
    .prepare('SELECT password_hash FROM users WHERE id = ? AND deleted_at IS NULL')
    .bind(userId)
    .first<{ password_hash: string }>()
  return !!row && (await verifyPassword(password, row.password_hash))
}

// Prüft das Passwort des eingeloggten Benutzers (für sensible Aktionen). Zählt wie ein Login-Versuch,
// damit eine übernommene Session nicht zum Durchprobieren des Passworts taugt.
async function confirmPassword(db: D1Database, user: User, password: string): Promise<boolean> {
  await countPasswordAttempt(db, user.username)
  const valid = await checkPassword(db, user.id, password)
  if (valid) await resetPasswordAttempts(db, user.username)
  return valid
}

export const authRoutes = new Hono<AppEnv>()

authRoutes.post('/login', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
  const { success } = await c.env.LOGIN_LIMITER.limit({ key: ip })
  if (!success) throw new HttpError(429, 'Zu viele Login-Versuche. Bitte warte eine Minute.')

  const body = await readJson<{ username: unknown; password: unknown }>(c)
  const username = normalizeUsername(body.username)
  const password = asText(body.password)
  await countPasswordAttempt(c.env.DB, username)

  const row = username
    ? await c.env.DB.prepare(
        'SELECT id, username, password_hash, is_admin, must_change_password FROM users WHERE username = ? AND deleted_at IS NULL',
      )
        .bind(username)
        .first<UserRow>()
    : null

  const valid = await verifyPassword(password, row?.password_hash ?? (await getDummyHash()))
  if (!row || !valid) throw new HttpError(401, LOGIN_FAILED)

  await resetPasswordAttempts(c.env.DB, username)
  const { token } = await createSession(c.env.DB, row.id)
  setCookie(c, SESSION_COOKIE, token, { ...COOKIE_OPTIONS, maxAge: SESSION_TTL_SECONDS })
  return c.json({ user: toUser(row) })
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

  // Wer das vorläufige Passwort gerade erst zum Login benutzt hat, muss es nicht erneut eingeben.
  const current = asText(body.currentPassword)
  if (!user.mustChangePassword && !(await confirmPassword(c.env.DB, user, current))) {
    throw new HttpError(400, 'Aktuelles Passwort ist falsch')
  }

  const newPassword = validatePassword(body.newPassword)
  const sameAsCurrent = user.mustChangePassword
    ? await checkPassword(c.env.DB, user.id, newPassword)
    : newPassword === current
  if (sameAsCurrent) {
    throw new HttpError(400, 'Das neue Passwort muss sich vom aktuellen unterscheiden')
  }
  await c.env.DB.prepare(
    'UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?',
  )
    .bind(await hashPassword(newPassword), user.id)
    .run()
  await deleteUserSessions(c.env.DB, user.id, c.var.sessionId!)
  return c.json({ ok: true })
})

// Löscht das eigene Konto (Soft Delete, Bestellungen bleiben erhalten). Zur Bestätigung ist das
// aktuelle Passwort nötig. Der letzte Admin bleibt erhalten, sonst könnte niemand mehr verwalten.
authRoutes.delete('/account', requireUser, async (c) => {
  const user = c.var.user!
  const body = await readJson<{ password: unknown }>(c)

  if (!(await confirmPassword(c.env.DB, user, asText(body.password)))) {
    throw new HttpError(400, 'Passwort ist falsch')
  }

  if (!(await deleteUserUnlessLastAdmin(c.env.DB, user.id))) {
    throw new HttpError(409, 'Der letzte Admin kann sein Konto nicht löschen')
  }
  deleteCookie(c, SESSION_COOKIE, COOKIE_OPTIONS)
  return c.json({ ok: true })
})
