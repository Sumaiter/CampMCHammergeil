import { getCookie } from 'hono/cookie'
import type { MiddlewareHandler } from 'hono'
import type { AppEnv } from './types'
import { getSession, SESSION_COOKIE } from './lib/session'
import { HttpError } from './lib/validation'

// Liest das Session-Cookie und hängt User + Session-ID an den Kontext (oder null).
export const loadUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE)
  const session = token ? await getSession(c.env.DB, token) : null
  c.set('user', session?.user ?? null)
  c.set('sessionId', session?.sessionId ?? null)
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
