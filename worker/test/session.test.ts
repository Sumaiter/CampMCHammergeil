import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  createSession,
  deleteSession,
  deleteUserSessions,
  getSession,
  hashToken,
} from '../lib/session'
import { resetDb } from './helpers'

const insertUser = async (username: string) => {
  const row = await env.DB.prepare(
    "INSERT INTO users (username, password_hash) VALUES (?, 'x') RETURNING id",
  )
    .bind(username)
    .first<{ id: number }>()
  return row!.id
}

const sessionIds = async () =>
  (await env.DB.prepare('SELECT id FROM sessions').all<{ id: string }>()).results.map((r) => r.id)

describe('Sessions', () => {
  let userId: number

  beforeEach(async () => {
    await resetDb()
    userId = await insertUser('josh')
  })

  it('speichert nur den Hash des Tokens', async () => {
    const { token, sessionId } = await createSession(env.DB, userId)
    expect(token.length).toBeGreaterThanOrEqual(43)
    expect(sessionId).toBe(await hashToken(token))
    expect(await sessionIds()).toEqual([sessionId])
    expect(await sessionIds()).not.toContain(token)
  })

  it('findet den Benutzer zur Session', async () => {
    const { token, sessionId } = await createSession(env.DB, userId)
    expect(await getSession(env.DB, token)).toEqual({
      sessionId,
      user: { id: userId, username: 'josh', isAdmin: false },
    })
  })

  it('abgelaufene Session ergibt null und wird gelöscht', async () => {
    const { token } = await createSession(env.DB, userId)
    expect(await getSession(env.DB, token, Date.now() + 2_592_001_000)).toBeNull()
    expect(await sessionIds()).toEqual([])
  })

  it('createSession räumt abgelaufene Sessions aller Benutzer auf', async () => {
    const other = await insertUser('anna')
    await createSession(env.DB, other, Date.now() - 2_592_001_000)
    const current = await createSession(env.DB, userId)
    expect(await sessionIds()).toEqual([current.sessionId])
  })

  it('unbekanntes Token ergibt null', async () => {
    expect(await getSession(env.DB, 'unbekannt')).toBeNull()
  })

  it('deleteSession löscht genau diese Session', async () => {
    const a = await createSession(env.DB, userId)
    const b = await createSession(env.DB, userId)
    await deleteSession(env.DB, a.sessionId)
    expect(await sessionIds()).toEqual([b.sessionId])
  })

  it('deleteUserSessions lässt nur die ausgenommene Session übrig', async () => {
    const keep = await createSession(env.DB, userId)
    await createSession(env.DB, userId)
    await createSession(env.DB, userId)
    await deleteUserSessions(env.DB, userId, keep.sessionId)
    expect(await sessionIds()).toEqual([keep.sessionId])
  })

  it('deleteUserSessions ohne Ausnahme löscht alle Sessions des Benutzers', async () => {
    const other = await insertUser('anna')
    const otherSession = await createSession(env.DB, other)
    await createSession(env.DB, userId)
    await deleteUserSessions(env.DB, userId)
    expect(await sessionIds()).toEqual([otherSession.sessionId])
  })
})
