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
    weather_code: number[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
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

function toWeather({ current, daily }: Forecast): Weather | null {
  if (typeof current?.temperature_2m !== 'number' || !Array.isArray(daily?.time)) return null
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
    daily: daily.time.map((date, i) => ({
      date,
      condition: mapWeatherCode(daily.weather_code[i]!).condition,
      max: daily.temperature_2m_max[i]!,
      min: daily.temperature_2m_min[i]!,
      rainChance: daily.precipitation_probability_max?.[i] ?? null,
    })),
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

export const weatherRoutes = new Hono<AppEnv>()

weatherRoutes.get('/', async (c) => {
  const cache = caches.default
  let cached = await cache.match(WEATHER_CACHE_KEY)

  if (!cached) {
    const weather = await fetchWeather()
    cached = Response.json(weather, {
      headers: { 'Cache-Control': `public, max-age=${CACHE_SECONDS}` },
    })
    await cache.put(WEATHER_CACHE_KEY, cached.clone())
  }

  return c.json((await cached.json()) as Weather, 200, {
    'Cache-Control': `public, max-age=${CLIENT_CACHE_SECONDS}`,
  })
})
