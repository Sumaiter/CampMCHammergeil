import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { api } from './helpers'

describe('Worker-Grundgerüst', () => {
  it('Unbekannte API-Route liefert 404 JSON', async () => {
    const res = await api('/api/gibtsnicht')
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Nicht gefunden' })
  })

  it('POST ohne JSON-Content-Type liefert 415', async () => {
    const res = await api('/api/auth/login', { method: 'POST', contentType: 'text/plain' })
    expect(res.status).toBe(415)
    expect(await res.json()).toEqual({ error: 'Content-Type muss application/json sein' })
  })

  it.each([
    ['Erfolg', () => api('/api/auth/me')],
    ['404', () => api('/api/gibtsnicht')],
    ['415', () => api('/api/auth/login', { method: 'POST', contentType: 'text/plain' })],
    ['HttpError', () => api('/api/auth/logout', { method: 'POST' })],
  ])('setzt Sicherheits-Header (%s)', async (_, request) => {
    const res = await request()
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(res.headers.get('X-Frame-Options')).toBe('DENY')
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer')
    expect(res.headers.get('Content-Security-Policy')).toBe(
      "default-src 'none'; frame-ancestors 'none'",
    )
  })

  it('Migration ist angewendet', async () => {
    const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE name = 'users'").first()
    expect(row).not.toBeNull()
  })
})
