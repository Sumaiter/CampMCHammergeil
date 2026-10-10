import router from '@/router'
import { RoutePath } from '@/router/routePath'
import type { LocationQueryRaw, RouteLocationRaw } from 'vue-router'

class RouterHelper {
  // Navigiert zu einer Route und ersetzt den aktuellen History-Eintrag
  // (kein "Zurück" zur vorherigen Seite möglich, z.B. nach Login).
  // @param path   Ziel-Route aus dem RoutePath-Enum
  // @param query  Optionale Query-Parameter, z.B. { id: '42' }
  replace(path: RoutePath, query?: LocationQueryRaw): Promise<unknown> {
    const location: RouteLocationRaw = query ? { path, query } : path
    return router.replace(location)
  }
}

// Singleton-Instanz – einfach importieren und nutzen:
// import { routerHelper } from '@/router/routerHelper'
// routerHelper.replace(RoutePath.Login)
export const routerHelper = new RouterHelper()
