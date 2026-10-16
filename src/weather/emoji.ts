import type { WeatherCondition } from '@/api/types'

const EMOJI: Record<WeatherCondition, string> = {
  clear: '☀️',
  cloudy: '☁️',
  fog: '🌫️',
  rain: '🌧️',
  snow: '🌨️',
  storm: '⛈️',
}

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

export function weatherEmoji(condition: WeatherCondition, isDay = true): string {
  return condition === 'clear' && !isDay ? '🌙' : EMOJI[condition]
}

// date/today als YYYY-MM-DD (Ortszeit Nürburgring, so liefert es Open-Meteo)
export function weekdayLabel(date: string, today: string): string {
  if (date === today) return 'Heute'
  return WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()]!
}
