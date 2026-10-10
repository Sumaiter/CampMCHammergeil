import { describe, expect, it } from 'vitest'
import { centsToInput, formatPrice, formatPriceOrDash, parsePrice, paypalPayUrl } from './price'

// Intl nutzt ein geschütztes Leerzeichen vor dem Euro-Zeichen.
const normalize = (value: string) => value.replace(/ /g, ' ')

describe('formatPrice', () => {
  it('formatiert Cent als Euro mit Komma', () => {
    expect(normalize(formatPrice(150))).toBe('1,50 €')
    expect(normalize(formatPrice(5))).toBe('0,05 €')
    expect(normalize(formatPrice(0))).toBe('0,00 €')
    expect(normalize(formatPrice(123456))).toBe('1.234,56 €')
  })

  it('zeigt "kein Preis" bei null', () => {
    expect(formatPrice(null)).toBe('kein Preis')
  })
})

describe('formatPriceOrDash', () => {
  it('zeigt einen Strich bei null', () => {
    expect(formatPriceOrDash(null)).toBe('–')
    expect(normalize(formatPriceOrDash(150))).toBe('1,50 €')
  })
})

describe('centsToInput', () => {
  it('liefert Eingabetext mit Komma', () => {
    expect(centsToInput(150)).toBe('1,50')
    expect(centsToInput(200)).toBe('2,00')
    expect(centsToInput(null)).toBe('')
  })
})

describe('parsePrice', () => {
  it('versteht Komma und Punkt', () => {
    expect(parsePrice('1,50')).toEqual({ ok: true, cents: 150 })
    expect(parsePrice('1.5')).toEqual({ ok: true, cents: 150 })
    expect(parsePrice('2')).toEqual({ ok: true, cents: 200 })
    expect(parsePrice('0,05')).toEqual({ ok: true, cents: 5 })
    expect(parsePrice('0')).toEqual({ ok: true, cents: 0 })
  })

  it('ignoriert Leerzeichen und Euro-Zeichen', () => {
    expect(parsePrice(' 2,50 € ')).toEqual({ ok: true, cents: 250 })
  })

  it('rundet ohne Gleitkomma-Fehler', () => {
    expect(parsePrice('1,15')).toEqual({ ok: true, cents: 115 })
    expect(parsePrice('19,99')).toEqual({ ok: true, cents: 1999 })
  })

  it('leere Eingabe bedeutet kein Preis', () => {
    expect(parsePrice('')).toEqual({ ok: true, cents: null })
    expect(parsePrice('   ')).toEqual({ ok: true, cents: null })
  })

  it('lehnt ungültige Eingaben ab', () => {
    expect(parsePrice('abc')).toEqual({ ok: false })
    expect(parsePrice('-1')).toEqual({ ok: false })
    expect(parsePrice('1,234')).toEqual({ ok: false })
    expect(parsePrice('1,2,3')).toEqual({ ok: false })
    expect(parsePrice('1e3')).toEqual({ ok: false })
  })
})

describe('paypalPayUrl', () => {
  it('baut den PayPal.Me-Link mit Punkt-Betrag', () => {
    expect(paypalPayUrl(1250)).toBe('https://paypal.me/joshuaniernetz/12.50EUR')
    expect(paypalPayUrl(5)).toBe('https://paypal.me/joshuaniernetz/0.05EUR')
    expect(paypalPayUrl(123456)).toBe('https://paypal.me/joshuaniernetz/1234.56EUR')
  })
})
