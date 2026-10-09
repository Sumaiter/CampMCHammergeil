import type { Context } from 'hono'

export type HttpErrorStatus = 400 | 401 | 403 | 404 | 409 | 415 | 429

// Erwarteter Fehler mit deutscher Meldung – wird vom zentralen Error-Handler als JSON ausgegeben.
export class HttpError extends Error {
  constructor(
    public status: HttpErrorStatus,
    message: string,
  ) {
    super(message)
  }
}

// Liest den JSON-Body. Kaputtes JSON oder etwas anderes als ein Objekt ergibt 400.
export async function readJson<T extends Record<string, unknown>>(
  c: Context,
): Promise<Partial<T>> {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    throw new HttpError(400, 'Ungültige Anfrage')
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new HttpError(400, 'Ungültige Anfrage')
  }
  return body as Partial<T>
}
