import { computed, readonly, ref } from 'vue'
import { api } from '@/api/client'
import type { Weather, WeatherCondition, WeatherScene } from '@/api/types'

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

const weather = ref<Weather | null>(readLast())
const effectsEnabled = ref(readStorage(EFFECTS_KEY) !== '0')
const override = devOverride()

const scene = computed<WeatherScene | null>(() => {
  if (!effectsEnabled.value) return null
  if (override) return { condition: override, intensity: 1 }
  const current = weather.value?.current
  return current ? { condition: current.condition, intensity: current.intensity } : null
})

export const isStale = (data: Pick<Weather, 'updatedAt'>, now: number): boolean =>
  now - Date.parse(data.updatedAt) > STALE_MS

async function refresh(): Promise<void> {
  try {
    const data = await api.get<Weather>('/api/weather')
    weather.value = data
    writeStorage(LAST_KEY, JSON.stringify(data))
  } catch {
    // Kein Netz oder Open-Meteo weg: alter Stand bleibt stehen
  }
}

function setEffectsEnabled(on: boolean): void {
  effectsEnabled.value = on
  writeStorage(EFFECTS_KEY, on ? '1' : '0')
}

// Lädt sofort und dann alle 15 Minuten, solange der Tab sichtbar ist. Gibt die Aufräumfunktion zurück.
function start(): () => void {
  let lastLoad = 0
  const load = () => {
    lastLoad = Date.now()
    void refresh()
  }

  const timer = setInterval(() => {
    if (document.visibilityState === 'visible') load()
  }, REFRESH_MS)

  const onVisibility = () => {
    if (document.visibilityState === 'visible' && Date.now() - lastLoad > REFRESH_MS) load()
  }

  load()
  document.addEventListener('visibilitychange', onVisibility)
  return () => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisibility)
  }
}

export function useWeather() {
  return {
    weather: readonly(weather),
    effectsEnabled: readonly(effectsEnabled),
    scene,
    setEffectsEnabled,
    refresh,
    start,
  }
}
