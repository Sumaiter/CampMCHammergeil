import { describe, expect, it } from 'vitest'
import { normalizeUsername, validatePassword, validateUsername } from '../lib/validation'

describe('normalizeUsername', () => {
  it('trimmt Leerzeichen', () => {
    expect(normalizeUsername('  josh ')).toBe('josh')
  })

  it('liefert leeren String bei Nicht-String', () => {
    expect(normalizeUsername(5)).toBe('')
  })
})

describe('validateUsername', () => {
  it.each(['ab', 'a'.repeat(33), 'jo sh', 'jösh', ''])('lehnt %j ab', (name) => {
    expect(() => validateUsername(name)).toThrow(
      'Benutzername muss 3–32 Zeichen lang sein und darf nur Buchstaben, Ziffern, . _ - enthalten',
    )
  })

  it('akzeptiert gültige Namen', () => {
    expect(() => validateUsername('Josh_1.-')).not.toThrow()
  })
})

describe('validatePassword', () => {
  it.each(['1234567', 'x'.repeat(129), undefined, 12345678])('lehnt %j ab', (value) => {
    expect(() => validatePassword(value)).toThrow('Passwort muss 8–128 Zeichen lang sein')
  })

  it('gibt gültiges Passwort zurück', () => {
    expect(validatePassword('12345678')).toBe('12345678')
  })
})
