import type { RouteMeta } from 'vue-router'
import type { User } from '@/api/types'
import { RoutePath } from './routePath'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    requiresAdmin?: boolean
  }
}

type Target = { path: string; fullPath: string; meta: RouteMeta }

// Entscheidet, ob eine Navigation erlaubt ist (true) oder wohin umgeleitet wird.
export function resolveNavigation(to: Target, user: User | null): string | true {
  if (to.path === RoutePath.Login && user) return RoutePath.Account

  if ((to.meta.requiresAuth || to.meta.requiresAdmin) && !user) {
    return `${RoutePath.Login}?redirect=${encodeURIComponent(to.fullPath)}`
  }

  if (to.meta.requiresAdmin && !user?.isAdmin) return RoutePath.Home

  return true
}

// Nur interne Pfade als Ziel nach dem Login zulassen – keine fremden Seiten.
export function safeRedirect(value: unknown): string {
  if (typeof value !== 'string') return RoutePath.Home
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return RoutePath.Home
  }
  return value
}
