import { describe, expect, it } from 'vitest'
import { weatherEmoji, weekdayLabel } from './emoji'

describe('weatherEmoji', () => {
  it.each([
    ['clear', true, '☀️'],
    ['clear', false, '🌙'],
    ['cloudy', true, '☁️'],
    ['fog', true, '🌫️'],
    ['rain', true, '🌧️'],
    ['snow', true, '🌨️'],
    ['storm', false, '⛈️'],
  ] as const)('%s (Tag: %s) → %s', (condition, isDay, emoji) => {
    expect(weatherEmoji(condition, isDay)).toBe(emoji)
  })
})

describe('weekdayLabel', () => {
  it('zeigt „Heute“ für heute', () => {
    expect(weekdayLabel('2026-10-16', '2026-10-16')).toBe('Heute')
  })

  it.each([
    ['2026-10-17', 'Sa'],
    ['2026-10-18', 'So'],
    ['2026-10-19', 'Mo'],
  ])('%s → %s', (date, label) => {
    expect(weekdayLabel(date, '2026-10-16')).toBe(label)
  })
})
