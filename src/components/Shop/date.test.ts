import { describe, expect, it } from 'vitest'
import { formatListTitle, parseServerDate } from './date'

describe('parseServerDate', () => {
  it('liest Serverzeit als UTC', () => {
    expect(parseServerDate('2026-10-10 12:30:00').toISOString()).toBe('2026-10-10T12:30:00.000Z')
  })
})

describe('formatListTitle', () => {
  it('nennt Datum und Uhrzeit', () => {
    expect(formatListTitle('2026-10-10 12:30:00')).toMatch(
      /^Liste vom \d{2}\.\d{2}\.\d{4}, \d{2}:\d{2} Uhr$/,
    )
  })

  it('unterscheidet zwei Drucke am selben Tag', () => {
    expect(formatListTitle('2026-10-10 08:00:00')).not.toBe(formatListTitle('2026-10-10 09:15:00'))
  })
})
