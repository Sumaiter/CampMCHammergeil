import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Weather } from '@/api/types'

const weather = (updatedAt = '2026-10-16T12:30:00.000Z'): Weather => ({
  current: { temperature: 17.3, condition: 'rain', intensity: 0.6, isDay: true, windKmh: 12 },
  daily: [{ date: '2026-10-16', condition: 'rain', max: 18, min: 9, rainChance: 80 }],
  updatedAt,
})

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function storageStub(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, String(value)),
    removeItem: (key: string) => void data.delete(key),
  }
}

// Modulzustand ist global – jeder Test lädt das Modul frisch.
const load = () => import('./useWeather')

describe('useWeather', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let storage: ReturnType<typeof storageStub>

  const setup = (initial: Record<string, string> = {}) => {
    storage = storageStub(initial)
    vi.stubGlobal('localStorage', storage)
  }

  beforeEach(() => {
    vi.resetModules()
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    setup()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('zeigt gespeicherten Stand sofort', async () => {
    setup({ 'weather:last': JSON.stringify(weather()) })
    const { useWeather } = await load()
    expect(useWeather().weather.value).toEqual(weather())
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each(['{kaputt', '{"foo":1}', '"text"', 'null'])(
    'ignoriert kaputten Stand %s',
    async (raw) => {
      setup({ 'weather:last': raw })
      const { useWeather } = await load()
      expect(useWeather().weather.value).toBeNull()
    },
  )

  it('refresh speichert neue Daten', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, weather()))
    const { useWeather } = await load()
    const { weather: current, refresh } = useWeather()
    await refresh()
    expect(fetchMock).toHaveBeenCalledWith('/api/weather', expect.anything())
    expect(current.value).toEqual(weather())
    expect(JSON.parse(storage.data.get('weather:last')!)).toEqual(weather())
  })

  it('Fehler behält alten Stand', async () => {
    setup({ 'weather:last': JSON.stringify(weather()) })
    fetchMock.mockResolvedValue(jsonResponse(502, { error: 'Wetter nicht verfügbar' }))
    const { useWeather } = await load()
    const { weather: current, refresh } = useWeather()
    await expect(refresh()).resolves.toBeUndefined()
    expect(current.value).toEqual(weather())
  })

  it('liefert die Szene aus dem aktuellen Wetter', async () => {
    setup({ 'weather:last': JSON.stringify(weather()) })
    const { useWeather } = await load()
    expect(useWeather().scene.value).toEqual({ condition: 'rain', intensity: 0.6 })
  })

  it('Schalter wird gespeichert', async () => {
    setup({ 'weather:last': JSON.stringify(weather()) })
    const first = (await load()).useWeather()
    expect(first.effectsEnabled.value).toBe(true)
    first.setEffectsEnabled(false)
    expect(storage.data.get('weather:effects')).toBe('0')
    expect(first.scene.value).toBeNull()

    vi.resetModules()
    const second = (await load()).useWeather()
    expect(second.effectsEnabled.value).toBe(false)
  })

  it('isStale erst nach einer Stunde', async () => {
    const { isStale } = await load()
    const now = Date.parse('2026-10-16T13:30:00.000Z')
    expect(isStale(weather('2026-10-16T12:31:00.000Z'), now)).toBe(false)
    expect(isStale(weather('2026-10-16T12:29:00.000Z'), now)).toBe(true)
  })
})
