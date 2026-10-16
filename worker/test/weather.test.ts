import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from './helpers'
import { WEATHER_CACHE_KEY } from '../routes/weather'

const DATES = ['2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19']

const forecast = {
  current: {
    time: '2026-10-16T14:30',
    temperature_2m: 17.3,
    weather_code: 63,
    is_day: 1,
    wind_speed_10m: 12.5,
  },
  daily: {
    time: DATES,
    weather_code: [63, 0, 3, 95],
    temperature_2m_max: [18.1, 20.4, 15.2, 12],
    temperature_2m_min: [9.4, 8, 7.5, 6.1],
    precipitation_probability_max: [80, 0, 20, null],
  },
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('GET /api/weather', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(async () => {
    await caches.default.delete(WEATHER_CACHE_KEY)
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json(200, forecast))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('liefert kompaktes Wetter', async () => {
    const res = await api('/api/weather')
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=300')

    const body = (await res.json()) as Record<string, unknown> & { daily: unknown[] }
    expect(body.current).toEqual({
      temperature: 17.3,
      condition: 'rain',
      intensity: 0.6,
      isDay: true,
      windKmh: 12.5,
    })
    expect(body.daily).toEqual([
      { date: '2026-10-16', condition: 'rain', max: 18.1, min: 9.4, rainChance: 80 },
      { date: '2026-10-17', condition: 'clear', max: 20.4, min: 8, rainChance: 0 },
      { date: '2026-10-18', condition: 'cloudy', max: 15.2, min: 7.5, rainChance: 20 },
      { date: '2026-10-19', condition: 'storm', max: 12, min: 6.1, rainChance: null },
    ])
    expect(typeof body.updatedAt).toBe('string')
  })

  it('fragt Open-Meteo innerhalb von 15 Minuten nur einmal', async () => {
    expect((await api('/api/weather')).status).toBe(200)
    expect((await api('/api/weather')).status).toBe(200)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const url = String(fetchSpy.mock.calls[0]![0])
    expect(url).toContain('latitude=50.3356')
    expect(url).toContain('longitude=6.9475')
  })

  it('meldet 502, wenn Open-Meteo ausfällt', async () => {
    fetchSpy.mockImplementation(async () => json(500, { error: true }))
    const res = await api('/api/weather')
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: 'Wetter nicht verfügbar' })
  })

  it('meldet 502 bei unerwartetem Format und cacht nichts', async () => {
    fetchSpy.mockImplementationOnce(async () => json(200, {}))
    expect((await api('/api/weather')).status).toBe(502)
    expect((await api('/api/weather')).status).toBe(200)
  })
})
