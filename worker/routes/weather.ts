import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { HttpError } from '../lib/validation'
import { mapWeatherCode, type WeatherCondition } from '../lib/weatherCode'

// Wetter am Nürburgring über Open-Meteo. Besucher sprechen nur mit uns – der Worker fragt
// höchstens alle 15 Minuten nach und gibt eine kompakte Antwort (~1 KB) weiter.

export const WEATHER_CACHE_KEY = 'https://cache.internal/weather'

const UPSTREAM_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=50.3356&longitude=6.9475' +
  '&current=temperature_2m,weather_code,is_day,wind_speed_10m' +
  '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
  '&timezone=Europe%2FBerlin&forecast_days=4'

const UPSTREAM_TIMEOUT_MS = 5000
const CACHE_SECONDS = 15 * 60
const CLIENT_CACHE_SECONDS = 5 * 60
const UNAVAILABLE = 'Wetter nicht verfügbar'

type Forecast = {
  current?: { temperature_2m: number; weather_code: number; is_day: number; wind_speed_10m: number }
  daily?: {
    time: string[]
    weather_code: (number | null)[]
    temperature_2m_max: (number | null)[]
    temperature_2m_min: (number | null)[]
    precipitation_probability_max?: (number | null)[]
  }
}

type Weather = {
  current: {
    temperature: number
    condition: WeatherCondition
    intensity: number
    isDay: boolean
    windKmh: number
  }
  daily: {
    date: string
    condition: WeatherCondition
    max: number
    min: number
    rainChance: number | null
  }[]
  updatedAt: string
}

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

function toWeather({ current, daily }: Forecast): Weather | null {
  if (
    !current ||
    ![current.temperature_2m, current.weather_code, current.is_day, current.wind_speed_10m].every(
      isNumber,
    ) ||
    !Array.isArray(daily?.time)
  ) {
    return null
  }
  const days = daily.time.length
  if (
    [daily.weather_code, daily.temperature_2m_max, daily.temperature_2m_min].some(
      (values) => !Array.isArray(values) || values.length !== days,
    )
  ) {
    return null
  }

  return {
    current: {
      temperature: current.temperature_2m,
      ...mapWeatherCode(current.weather_code),
      isDay: current.is_day === 1,
      windKmh: current.wind_speed_10m,
    },
    // Open-Meteo liefert für fehlende Werte null – solche Tage lassen wir weg
    daily: daily.time.flatMap((date, i) => {
      const code = daily.weather_code[i]
      const max = daily.temperature_2m_max[i]
      const min = daily.temperature_2m_min[i]
      if (!isNumber(code) || !isNumber(max) || !isNumber(min)) return []
      const rainChance = daily.precipitation_probability_max?.[i]
      return [
        {
          date,
          condition: mapWeatherCode(code).condition,
          max,
          min,
          rainChance: isNumber(rainChance) ? rainChance : null,
        },
      ]
    }),
    updatedAt: new Date().toISOString(),
  }
}

async function fetchWeather(): Promise<Weather> {
  let res: Response
  try {
    res = await fetch(UPSTREAM_URL, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) })
  } catch {
    throw new HttpError(502, UNAVAILABLE)
  }
  const weather = res.ok ? toWeather((await res.json().catch(() => ({}))) as Forecast) : null
  if (!weather) throw new HttpError(502, UNAVAILABLE)
  return weather
}

// Auf *.workers.dev ist die Cache API wirkungslos – deshalb zusätzlich im Speicher der
// Worker-Instanz. Die Cache API greift, sobald die Seite auf einer eigenen Domain läuft.
let memory: { weather: Weather; expires: number } | null = null

async function cachedWeather(): Promise<Weather> {
  if (memory && memory.expires > Date.now()) return memory.weather

  const cache = caches.default
  const hit = await cache.match(WEATHER_CACHE_KEY)
  const weather = hit ? ((await hit.json()) as Weather) : await fetchWeather()
  if (!hit) {
    const response = Response.json(weather, {
      headers: { 'Cache-Control': `public, max-age=${CACHE_SECONDS}` },
    })
    await cache.put(WEATHER_CACHE_KEY, response)
  }

  // Ablauf richtet sich nach dem Abrufzeitpunkt, auch wenn der Treffer aus der Cache API kam
  memory = { weather, expires: Date.parse(weather.updatedAt) + CACHE_SECONDS * 1000 }
  return weather
}

export const weatherRoutes = new Hono<AppEnv>()

weatherRoutes.get('/', async (c) => {
  return c.json(await cachedWeather(), 200, {
    'Cache-Control': `public, max-age=${CLIENT_CACHE_SECONDS}`,
  })
})

// Leert beide Caches (für Tests)
export async function clearWeatherCache(): Promise<void> {
  memory = null
  await caches.default.delete(WEATHER_CACHE_KEY)
}
