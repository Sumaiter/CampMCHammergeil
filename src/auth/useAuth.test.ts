import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const josh = { id: 1, username: 'josh', isAdmin: false, mustChangePassword: false }

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

// Modulzustand ist global – jeder Test lädt die Module frisch.
async function load() {
  const auth = await import('./useAuth')
  const client = await import('@/api/client')
  return { useAuth: auth.useAuth, ...client }
}

describe('useAuth', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.resetModules()
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lädt /api/auth/me bei parallelen Aufrufen nur einmal', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { user: josh }))
    const { useAuth } = await load()
    const auth = useAuth()
    await Promise.all([auth.ensureLoaded(), auth.ensureLoaded()])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/auth/me')
    expect(auth.user.value).toEqual(josh)
    expect(auth.isAdmin.value).toBe(false)
  })

  it('setzt user bei Netzwerkfehler auf null und versucht es beim nächsten Mal erneut', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('offline'))
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { user: josh }))
    const { useAuth } = await load()
    const auth = useAuth()
    await auth.ensureLoaded()
    expect(auth.user.value).toBeNull()
    await auth.ensureLoaded()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(auth.user.value).toEqual(josh)
  })

  it('login sendet die Daten als JSON und setzt user', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { user: josh }))
    const { useAuth } = await load()
    const auth = useAuth()
    await auth.login('josh', 'geheim123')
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/auth/login')
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(init.body)).toEqual({ username: 'josh', password: 'geheim123' })
    expect(auth.user.value).toEqual(josh)
  })

  it('login wirft bei 401 einen ApiError mit der Server-Meldung', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { error: 'Benutzername oder Passwort falsch' }))
    const { useAuth, ApiError } = await load()
    const auth = useAuth()
    const error = await auth.login('josh', 'falsch').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 401, message: 'Benutzername oder Passwort falsch' })
    expect(auth.user.value).toBeNull()
  })

  it('logout ruft den Server auf und setzt user auf null', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { user: josh }))
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }))
    const { useAuth } = await load()
    const auth = useAuth()
    await auth.login('josh', 'geheim123')
    await auth.logout()
    expect(fetchMock.mock.calls[1]![0]).toBe('/api/auth/logout')
    expect(fetchMock.mock.calls[1]![1].method).toBe('POST')
    expect(auth.user.value).toBeNull()
  })

  it('logout gilt bei 401 als erfolgreich, weil die Session schon beendet ist', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { user: josh }))
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: 'Nicht eingeloggt' }))
    const { useAuth } = await load()
    const auth = useAuth()
    await auth.login('josh', 'geheim123')
    await expect(auth.logout()).resolves.toBeUndefined()
    expect(auth.user.value).toBeNull()
  })

  it('passwordChanged hebt die Passwortsperre im lokalen Zustand auf', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { user: { ...josh, mustChangePassword: true } }))
    const { useAuth } = await load()
    const auth = useAuth()
    await auth.login('josh', 'startpass1')
    expect(auth.user.value?.mustChangePassword).toBe(true)
    auth.passwordChanged()
    expect(auth.user.value).toEqual(josh)
  })

  it('deleteAccount sendet das Passwort per DELETE und setzt user auf null', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { user: josh }))
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }))
    const { useAuth } = await load()
    const auth = useAuth()
    await auth.login('josh', 'geheim123')
    await auth.deleteAccount('geheim123')
    const [url, init] = fetchMock.mock.calls[1]!
    expect(url).toBe('/api/auth/account')
    expect(init.method).toBe('DELETE')
    expect(JSON.parse(init.body)).toEqual({ password: 'geheim123' })
    expect(auth.user.value).toBeNull()
  })

  it('deleteAccount behält den Login, wenn der Server ablehnt', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { user: josh }))
    fetchMock.mockResolvedValueOnce(jsonResponse(400, { error: 'Passwort ist falsch' }))
    const { useAuth } = await load()
    const auth = useAuth()
    await auth.login('josh', 'geheim123')
    await expect(auth.deleteAccount('falsch')).rejects.toMatchObject({ status: 400 })
    expect(auth.user.value).toEqual(josh)
  })

  it('setzt user auf null, wenn irgendeine Anfrage 401 liefert', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { user: josh }))
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: 'Nicht eingeloggt' }))
    const { useAuth, api } = await load()
    const auth = useAuth()
    await auth.ensureLoaded()
    await expect(api.get('/api/admin/users')).rejects.toMatchObject({ status: 401 })
    expect(auth.user.value).toBeNull()
  })
})

describe('api', () => {
  beforeEach(() => vi.resetModules())
  afterEach(() => vi.unstubAllGlobals())

  it('nutzt eine Standardmeldung, wenn der Server keinen Fehlertext liefert', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('kaputt', { status: 500 })))
    const { api } = await import('@/api/client')
    await expect(api.get('/api/x')).rejects.toMatchObject({
      status: 500,
      message: 'Unbekannter Fehler',
    })
  })
})
