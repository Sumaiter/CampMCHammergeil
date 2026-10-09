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

  it('Migration ist angewendet', async () => {
    const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE name = 'users'").first()
    expect(row).not.toBeNull()
  })
})
