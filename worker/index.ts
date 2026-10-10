import { Hono } from 'hono'
import type { AppEnv } from './types'
import { HttpError } from './lib/validation'
import { loadUser } from './middleware'
import { authRoutes } from './routes/auth'
import { adminRoutes } from './routes/admin'
import { shopRoutes } from './routes/shop'

const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE']

export const app = new Hono<AppEnv>()

// Schreibende Anfragen nur als JSON – zusammen mit SameSite=Lax der Schutz gegen CSRF.
app.use('/api/*', async (c, next) => {
  const contentType = c.req.header('Content-Type') ?? ''
  if (WRITE_METHODS.includes(c.req.method) && !contentType.startsWith('application/json')) {
    return c.json({ error: 'Content-Type muss application/json sein' }, 415)
  }
  await next()
})

app.use('/api/*', loadUser)

app.route('/api/auth', authRoutes)
app.route('/api/admin', adminRoutes)
app.route('/api/shop', shopRoutes)

app.notFound((c) => c.json({ error: 'Nicht gefunden' }, 404))

app.onError((err, c) => {
  if (err instanceof HttpError) {
    const body = err.code ? { error: err.message, code: err.code } : { error: err.message }
    return c.json(body, err.status)
  }
  console.error(err)
  return c.json({ error: 'Interner Fehler' }, 500)
})

export default app
