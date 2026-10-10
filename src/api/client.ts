// Kleine fetch-Hülle für die Worker-API (/api/*).
// Fehler kommen als ApiError mit der deutschen Meldung vom Server.

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

let unauthorizedHandler: (() => void) | undefined

// Wird aufgerufen, sobald der Server 401 meldet (z. B. Session abgelaufen).
export function onUnauthorized(handler: () => void): void {
  unauthorizedHandler = handler
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = (await res.json().catch(() => null)) as { error?: string } | null

  if (!res.ok) {
    if (res.status === 401) unauthorizedHandler?.()
    throw new ApiError(res.status, data?.error ?? 'Unbekannter Fehler')
  }
  return data as T
}

// Meldung des Servers bei ApiError, sonst der übergebene Ersatztext.
export const errorMessage = (err: unknown, fallback: string): string =>
  err instanceof ApiError ? err.message : fallback

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string, body?: unknown) => request<T>('DELETE', path, body),
}
