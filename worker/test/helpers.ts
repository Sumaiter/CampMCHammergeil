import { env, exports } from 'cloudflare:workers'

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
  await env.DB.batch([env.DB.prepare('DELETE FROM sessions'), env.DB.prepare('DELETE FROM users')])
}
