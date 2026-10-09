import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '../lib/password'

describe('Passwort-Hashing', () => {
  it('erzeugt das pbkdf2-Format mit 100000 Iterationen', async () => {
    const h = await hashPassword('geheim123')
    expect(h).toMatch(/^pbkdf2\$100000\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/)
  })

  it('verifiziert richtiges und lehnt falsches Passwort ab', async () => {
    const h = await hashPassword('geheim123')
    expect(await verifyPassword('geheim123', h)).toBe(true)
    expect(await verifyPassword('geheim124', h)).toBe(false)
  })

  it('nutzt zufälligen Salt', async () => {
    expect(await hashPassword('geheim123')).not.toBe(await hashPassword('geheim123'))
  })

  it('liefert false bei kaputtem Hash statt zu werfen', async () => {
    expect(await verifyPassword('x', 'kaputt')).toBe(false)
    expect(await verifyPassword('x', 'pbkdf2$abc$$')).toBe(false)
  })
})
