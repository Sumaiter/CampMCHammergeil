import { computed, readonly, ref, type DeepReadonly } from 'vue'
import { api } from '@/api/client'
import type { Weather, WeatherCondition, WeatherScene } from '@/api/types'
import { weekdayLabel } from './emoji'

type StoredWeather = DeepReadonly<Weather>

// Globaler Wetter-Zustand. Der letzte Stand liegt im localStorage, damit das Wetter auch bei
// schlechtem Netz (Rock am Ring!) sofort da ist; aktualisiert wird still im Hintergrund.

export const REFRESH_MS = 15 * 60_000
export const STALE_MS = 60 * 60_000

const LAST_KEY = 'weather:last'
const EFFECTS_KEY = 'weather:effects'
const CONDITIONS: WeatherCondition[] = ['clear', 'cloudy', 'fog', 'rain', 'snow', 'storm']

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Speicher voll oder gesperrt – dann eben ohne Zwischenspeicher
  }
}

function readLast(): Weather | null {
  try {
    const data = JSON.parse(readStorage(LAST_KEY) ?? 'null') as Partial<Weather> | null
    const valid =
      typeof data?.current?.condition === 'string' &&
      typeof data.current.temperature === 'number' &&
      Array.isArray(data.daily) &&
      typeof data.updatedAt === 'string'
    return valid ? (data as Weather) : null
  } catch {
    return null
  }
}

// Nur im Dev-Build: ?weather=storm erzwingt einen Zustand zum Ausprobieren der Effekte.
function devOverride(): WeatherCondition | null {
  if (!import.meta.env.DEV || typeof location === 'undefined') return null
  const value = new URLSearchParams(location.search).get('weather') as WeatherCondition | null
  return value && CONDITIONS.includes(value) ? value : null
}

// Ältere Daten zeigen wir noch an, lassen aber kein Wetter mehr über den Planeten ziehen
export const SCENE_MAX_AGE_MS = 6 * 60 * 60_000

const TIME_ZONE = 'Europe/Berlin'
const berlinDate = new Intl.DateTimeFormat('sv-SE', { timeZone: TIME_ZONE }) // YYYY-MM-DD
const berlinTime = new Intl.DateTimeFormat('de-DE', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
})
const berlinDay = new Intl.DateTimeFormat('de-DE', {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
})

const age = (data: StoredWeather, now: number) => now - Date.parse(data.updatedAt)

// „Stand 14:30“ bzw. „Stand 16.10. 14:30“, sobald die Daten älter als eine Stunde sind
export function staleLabel(data: StoredWeather, now: number): string | null {
  if (age(data, now) <= STALE_MS) return null
  const updated = Date.parse(data.updatedAt)
  const time = berlinTime.format(updated)
  const sameDay = berlinDate.format(updated) === berlinDate.format(now)
  return sameDay ? `Stand ${time}` : `Stand ${berlinDay.format(updated)} ${time}`
}

// Vorhersage ab heute (Nürburgring-Zeit); Tage, die schon vorbei sind, fallen weg
export function forecastDays(data: StoredWeather, now: number) {
  const today = berlinDate.format(now)
  return data.daily
    .filter((day) => day.date >= today)
    .map((day) => ({ ...day, label: weekdayLabel(day.date, today) }))
}

export function sceneFor(data: StoredWeather | null, now: number): WeatherScene | null {
  if (!data || age(data, now) > SCENE_MAX_AGE_MS) return null
  return { condition: data.current.condition, intensity: data.current.intensity }
}

const weather = ref<Weather | null>(readLast())
const effectsEnabled = ref(readStorage(EFFECTS_KEY) !== '0')
const now = ref(Date.now())
const override = devOverride()

const scene = computed<WeatherScene | null>(() => {
  if (!effectsEnabled.value) return null
  if (override) return { condition: override, intensity: 1 }
  return sceneFor(weather.value, now.value)
})

// true, wenn neue Daten angekommen sind
async function loadLatest(): Promise<boolean> {
  try {
    const data = await api.get<Weather>('/api/weather')
    weather.value = data
    writeStorage(LAST_KEY, JSON.stringify(data))
    return true
  } catch {
    // Kein Netz oder Open-Meteo weg: alter Stand bleibt stehen
    return false
  }
}

async function refresh(): Promise<void> {
  await loadLatest()
}

function setEffectsEnabled(on: boolean): void {
  effectsEnabled.value = on
  writeStorage(EFFECTS_KEY, on ? '1' : '0')
}

// Lädt sofort und dann alle 15 Minuten, solange der Tab sichtbar ist; nach einem Fehler erneut,
// sobald das Netz zurück ist oder der Tab wieder sichtbar wird. Gibt die Aufräumfunktion zurück.
function start(): () => void {
  let lastLoad = 0
  const load = async () => {
    if (await loadLatest()) lastLoad = Date.now()
  }
  const visible = () => document.visibilityState === 'visible'

  const refreshTimer = setInterval(() => {
    if (visible()) void load()
  }, REFRESH_MS)
  const clock = setInterval(() => (now.value = Date.now()), 60_000)

  const onVisibility = () => {
    if (visible() && Date.now() - lastLoad > REFRESH_MS) void load()
  }
  const onOnline = () => void load()

  void load()
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('online', onOnline)
  return () => {
    clearInterval(refreshTimer)
    clearInterval(clock)
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('online', onOnline)
  }
}

export function useWeather() {
  return {
    weather: readonly(weather),
    effectsEnabled: readonly(effectsEnabled),
    now: readonly(now),
    scene,
    setEffectsEnabled,
    refresh,
    start,
  }
}
