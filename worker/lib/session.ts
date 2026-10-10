import type { User } from '../types'

export const SESSION_COOKIE = 'session'
export const SESSION_TTL_SECONDS = 2_592_000 // 30 Tage

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')

// In der DB steht nur der Hash – ein DB-Leak reicht so nicht zum Einloggen.
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function createSession(
  db: D1Database,
  userId: number,
  now = Date.now(),
): Promise<{ token: string; sessionId: string }> {
  const token = toBase64Url(crypto.getRandomValues(new Uint8Array(32)))
  const sessionId = await hashToken(token)
  const nowSeconds = Math.floor(now / 1000)
  // Abgelaufene Sessions bei jedem Login aufräumen – verlassene Sessions (Browser zu, kein
  // Logout) würden sonst für immer in der DB liegen bleiben.
  await db.batch([
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(nowSeconds),
    db
      .prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
      .bind(sessionId, userId, nowSeconds + SESSION_TTL_SECONDS),
  ])
  return { token, sessionId }
}

type SessionRow = {
  session_id: string
  expires_at: number
  id: number
  username: string
  is_admin: number
}

export async function getSession(
  db: D1Database,
  token: string,
  now = Date.now(),
): Promise<{ sessionId: string; user: User } | null> {
  const sessionId = await hashToken(token)
  const row = await db
    .prepare(
      `SELECT s.id AS session_id, s.expires_at, u.id, u.username, u.is_admin
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`,
    )
    .bind(sessionId)
    .first<SessionRow>()
  if (!row) return null

  if (row.expires_at <= Math.floor(now / 1000)) {
    await deleteSession(db, sessionId)
    return null
  }

  return {
    sessionId: row.session_id,
    user: { id: row.id, username: row.username, isAdmin: row.is_admin === 1 },
  }
}

export async function deleteSession(db: D1Database, sessionId: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run()
}

// Löscht alle Sessions eines Benutzers, optional bis auf eine (z. B. die aktuelle).
export async function deleteUserSessions(
  db: D1Database,
  userId: number,
  exceptSessionId?: string,
): Promise<void> {
  await db
    .prepare('DELETE FROM sessions WHERE user_id = ? AND id IS NOT ?')
    .bind(userId, exceptSessionId ?? null)
    .run()
}
