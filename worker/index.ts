import { Hono } from 'hono'
import type { AppEnv } from './types'
import { HttpError } from './lib/validation'

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

app.notFound((c) => c.json({ error: 'Nicht gefunden' }, 404))

app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message }, err.status)
  console.error(err)
  return c.json({ error: 'Interner Fehler' }, 500)
})

export default app
