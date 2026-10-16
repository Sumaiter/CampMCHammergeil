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

  describe('alte Daten', () => {
    // 16.10. 14:30 in Berlin (MESZ = UTC+2)
    const saved = weather('2026-10-16T12:30:00.000Z')
    saved.daily = ['2026-10-16', '2026-10-17', '2026-10-18'].map((date) => ({
      date,
      condition: 'clear' as const,
      max: 20,
      min: 10,
      rainChance: 0,
    }))

    it('staleLabel: erst nach einer Stunde, mit Datum ab dem nächsten Tag', async () => {
      const { staleLabel } = await load()
      expect(staleLabel(saved, Date.parse('2026-10-16T13:29:00.000Z'))).toBeNull()
      expect(staleLabel(saved, Date.parse('2026-10-16T13:31:00.000Z'))).toBe('Stand 14:30')
      expect(staleLabel(saved, Date.parse('2026-10-17T06:00:00.000Z'))).toBe('Stand 16.10. 14:30')
    })

    it('forecastDays: vergangene Tage fallen weg, „Heute“ ist der echte heutige Tag', async () => {
      const { forecastDays } = await load()
      const nextMorning = Date.parse('2026-10-17T06:00:00.000Z')
      expect(forecastDays(saved, nextMorning).map((day) => [day.date, day.label])).toEqual([
        ['2026-10-17', 'Heute'],
        ['2026-10-18', 'So'],
      ])
    })

    it('sceneFor: keine Wettereffekte mehr, wenn die Daten älter als 6 Stunden sind', async () => {
      const { sceneFor } = await load()
      expect(sceneFor(saved, Date.parse('2026-10-16T18:00:00.000Z'))).toEqual({
        condition: 'rain',
        intensity: 0.6,
      })
      expect(sceneFor(saved, Date.parse('2026-10-16T18:31:00.000Z'))).toBeNull()
    })
  })

  describe('start', () => {
    let listeners: Record<string, (() => void)[]>

    beforeEach(() => {
      vi.useFakeTimers()
      listeners = {}
      const target = {
        visibilityState: 'visible',
        addEventListener: (type: string, fn: () => void) => (listeners[type] ??= []).push(fn),
        removeEventListener: (type: string, fn: () => void) =>
          (listeners[type] = (listeners[type] ?? []).filter((other) => other !== fn)),
      }
      vi.stubGlobal('document', target)
      vi.stubGlobal('window', target)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    const fire = (type: string) => listeners[type]?.forEach((fn) => fn())

    it('lädt nach einem Fehler erneut, sobald das Netz zurück ist', async () => {
      fetchMock.mockRejectedValueOnce(new TypeError('offline'))
      fetchMock.mockResolvedValue(jsonResponse(200, weather()))
      const { useWeather } = await load()
      const { weather: current, start } = useWeather()

      const stop = start()
      await vi.advanceTimersByTimeAsync(10)
      expect(current.value).toBeNull()

      fire('online')
      await vi.waitFor(() => expect(current.value).toEqual(weather()))
      expect(fetchMock).toHaveBeenCalledTimes(2)
      stop()
    })

    it('lädt beim Zurückkehren in den Tab neu, wenn der letzte Versuch fehlschlug', async () => {
      fetchMock.mockRejectedValueOnce(new TypeError('offline'))
      fetchMock.mockResolvedValue(jsonResponse(200, weather()))
      const { useWeather } = await load()
      const stop = useWeather().start()
      await vi.advanceTimersByTimeAsync(10)

      fire('visibilitychange')
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
      stop()
    })

    it('räumt Listener und Timer auf', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, weather()))
      const { useWeather } = await load()
      const stop = useWeather().start()
      stop()
      expect(Object.values(listeners).flat()).toEqual([])
      expect(vi.getTimerCount()).toBe(0)
    })
  })
})
