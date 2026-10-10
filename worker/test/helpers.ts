import { env, exports } from 'cloudflare:workers'
import { hashPassword } from '../lib/password'

type ApiInit = {
  method?: string
  body?: unknown
  cookie?: string
  ip?: string
  contentType?: string | null
}

const randomIp = () =>
  `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`

// Schickt eine Anfrage an den Worker. Jede Anfrage bekommt standardmäßig eine zufällige IP,
// damit sich das Login-Rate-Limit zwischen Tests nicht in die Quere kommt.
export function api(path: string, init: ApiInit = {}): Promise<Response> {
  const headers = new Headers({ 'CF-Connecting-IP': init.ip ?? randomIp() })
  const contentType = init.contentType === undefined ? 'application/json' : init.contentType
  if (contentType) headers.set('Content-Type', contentType)
  if (init.cookie) headers.set('Cookie', init.cookie)

  let body: string | undefined
  if (typeof init.body === 'string') body = init.body
  else if (init.body !== undefined) body = JSON.stringify(init.body)

  return exports.default.fetch(
    new Request(`https://example.com${path}`, { method: init.method ?? 'GET', headers, body }),
  )
}

export async function resetDb(): Promise<void> {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM shop_orders'),
    env.DB.prepare('DELETE FROM shop_items'),
    env.DB.prepare('DELETE FROM sessions'),
    env.DB.prepare('DELETE FROM users'),
  ])
}

export async function createUser(
  username: string,
  password: string,
  isAdmin = false,
  mustChangePassword = false,
): Promise<number> {
  const row = await env.DB.prepare(
    'INSERT INTO users (username, password_hash, is_admin, must_change_password) VALUES (?, ?, ?, ?) RETURNING id',
  )
    .bind(username, await hashPassword(password), isAdmin ? 1 : 0, mustChangePassword ? 1 : 0)
    .first<{ id: number }>()
  return row!.id
}

// Loggt sich ein und liefert den Wert für den Cookie-Header ("session=<token>").
export async function login(username: string, password: string): Promise<string> {
  const res = await api('/api/auth/login', { method: 'POST', body: { username, password } })
  if (res.status !== 200) throw new Error(`Login fehlgeschlagen: ${res.status}`)
  return res.headers.get('set-cookie')!.split(';')[0]!
}

export const me = async (cookie?: string) =>
  ((await (await api('/api/auth/me', { cookie })).json()) as { user: unknown }).user
