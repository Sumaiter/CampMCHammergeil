import type { Context } from 'hono'

export type HttpErrorStatus = 400 | 401 | 403 | 404 | 409 | 415 | 429

// Erwarteter Fehler mit deutscher Meldung – wird vom zentralen Error-Handler als JSON ausgegeben.
export class HttpError extends Error {
  constructor(
    public status: HttpErrorStatus,
    message: string,
    // Maschinenlesbarer Fehlercode für den Client (optional).
    public code?: string,
  ) {
    super(message)
  }
}

// Liest den JSON-Body. Kaputtes JSON oder etwas anderes als ein Objekt ergibt 400.
export async function readJson<T extends Record<string, unknown>>(c: Context): Promise<Partial<T>> {
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

const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,32}$/

export function normalizeUsername(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function validateUsername(name: string): void {
  if (!USERNAME_PATTERN.test(name)) {
    throw new HttpError(
      400,
      'Benutzername muss 3–32 Zeichen lang sein und darf nur Buchstaben, Ziffern, . _ - enthalten',
    )
  }
}

export function validatePassword(value: unknown): string {
  if (typeof value !== 'string' || value.length < 8 || value.length > 128) {
    throw new HttpError(400, 'Passwort muss 8–128 Zeichen lang sein')
  }
  return value
}
