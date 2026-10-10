import { describe, expect, it } from 'vitest'
import type { RouteMeta } from 'vue-router'
import type { User } from '@/api/types'
import { resolveNavigation, safeRedirect } from './guard'

const user: User = { id: 1, username: 'josh', isAdmin: false, mustChangePassword: false }
const admin: User = { id: 2, username: 'boss', isAdmin: true, mustChangePassword: false }
const pending: User = { ...user, mustChangePassword: true }
const pendingAdmin: User = { ...admin, mustChangePassword: true }

const to = (path: string, meta: RouteMeta = {}, fullPath = path) => ({ path, fullPath, meta })

describe('resolveNavigation', () => {
  it('lässt öffentliche Seiten ohne Login durch', () => {
    expect(resolveNavigation(to('/'), null)).toBe(true)
  })

  it('schickt geschützte Seiten ohne Login zum Login mit redirect', () => {
    expect(resolveNavigation(to('/shop', { requiresAuth: true }, '/shop?x=1'), null)).toBe(
      '/login?redirect=%2Fshop%3Fx%3D1',
    )
  })

  it('lässt geschützte Seiten mit Login durch', () => {
    expect(resolveNavigation(to('/shop', { requiresAuth: true }), user)).toBe(true)
  })

  it('schickt Admin-Seiten ohne Login zum Login', () => {
    expect(resolveNavigation(to('/admin', { requiresAdmin: true }), null)).toBe(
      '/login?redirect=%2Fadmin',
    )
  })

  it('schickt Nicht-Admins von Admin-Seiten zur Startseite', () => {
    expect(resolveNavigation(to('/admin', { requiresAdmin: true }), user)).toBe('/')
  })

  it('lässt Admins auf Admin-Seiten', () => {
    expect(resolveNavigation(to('/admin', { requiresAdmin: true }), admin)).toBe(true)
  })

  it('schickt Eingeloggte vom Login zum Konto', () => {
    expect(resolveNavigation(to('/login'), user)).toBe('/konto')
  })

  it('zeigt den Login ohne Anmeldung', () => {
    expect(resolveNavigation(to('/login'), null)).toBe(true)
  })
})

describe('resolveNavigation bei ausstehender Passwortänderung', () => {
  it.each([
    ['/', {}],
    ['/shop', { requiresAuth: true }],
    ['/login', {}],
    ['/datenschutz', {}],
  ])('schickt %s zur Kontoseite', (path, meta) => {
    expect(resolveNavigation(to(path, meta), pending)).toBe('/konto')
  })

  it('schickt auch Admins von Admin-Seiten zur Kontoseite', () => {
    expect(resolveNavigation(to('/admin', { requiresAdmin: true }), pendingAdmin)).toBe('/konto')
  })

  it('lässt die Kontoseite durch', () => {
    expect(resolveNavigation(to('/konto', { requiresAuth: true }), pending)).toBe(true)
  })

  it('lässt nach erfolgter Änderung wieder alles zu', () => {
    expect(resolveNavigation(to('/shop', { requiresAuth: true }), user)).toBe(true)
  })
})

describe('safeRedirect', () => {
  it('lässt interne Pfade durch', () => {
    expect(safeRedirect('/shop')).toBe('/shop')
    expect(safeRedirect('/shop?x=1')).toBe('/shop?x=1')
  })

  it.each(['//evil.com', 'https://evil.com', '/\\evil.com', '', undefined, ['/shop'], null])(
    'macht aus %j die Startseite',
    (value) => {
      expect(safeRedirect(value)).toBe('/')
    },
  )
})
