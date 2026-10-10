import { getCookie } from 'hono/cookie'
import type { MiddlewareHandler } from 'hono'
import type { AppEnv } from './types'
import { getSession, SESSION_COOKIE } from './lib/session'
import { HttpError } from './lib/validation'

export const PASSWORD_CHANGE_REQUIRED = 'password_change_required'

// Routen, die auch bei ausstehender Passwortänderung erreichbar bleiben: Sitzungsinfo, Login/Logout,
// Passwort ändern und – als Alternative zum Passwortwechsel – das eigene Konto löschen.
const ALLOWED_WHILE_PASSWORD_CHANGE_PENDING = new Set([
  'GET /api/auth/me',
  'POST /api/auth/login',
  'POST /api/auth/logout',
  'POST /api/auth/password',
  'DELETE /api/auth/account',
])

// Liest das Session-Cookie und hängt User + Session-ID an den Kontext (oder null).
// Muss der Benutzer sein Passwort noch ändern, sind alle anderen Routen gesperrt (403).
export const loadUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE)
  const session = token ? await getSession(c.env.DB, token) : null
  c.set('user', session?.user ?? null)
  c.set('sessionId', session?.sessionId ?? null)

  if (session?.user.mustChangePassword) {
    const route = `${c.req.method} ${new URL(c.req.url).pathname}`
    if (!ALLOWED_WHILE_PASSWORD_CHANGE_PENDING.has(route)) {
      throw new HttpError(403, 'Du musst zuerst dein Passwort ändern', PASSWORD_CHANGE_REQUIRED)
    }
  }
  await next()
}

export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.var.user) throw new HttpError(401, 'Nicht eingeloggt')
  await next()
}

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.var.user) throw new HttpError(401, 'Nicht eingeloggt')
  if (!c.var.user.isAdmin) throw new HttpError(403, 'Keine Berechtigung')
  await next()
}
