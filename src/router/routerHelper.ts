import router from '@/router'
import { RoutePath } from '@/router/routePath'
import type { LocationQueryRaw, RouteLocationRaw } from 'vue-router'

class RouterHelper {
  // Navigiert zu einer Route (fügt einen neuen History-Eintrag hinzu).
  // @param path   Ziel-Route aus dem RoutePath-Enum
  // @param query  Optionale Query-Parameter, z.B. { id: '42' }*/
  goTo(path: RoutePath, query?: LocationQueryRaw): Promise<unknown> {
    const location: RouteLocationRaw = query ? { path, query } : path
    return router.push(location)
  }

  // Navigiert zu einer Route, ersetzt aber den aktuellen History-Eintrag
  // (kein "Zurück" zur vorherigen Seite möglich, z.B. nach Login).*/
  replace(path: RoutePath, query?: LocationQueryRaw): Promise<unknown> {
    const location: RouteLocationRaw = query ? { path, query } : path
    return router.replace(location)
  }
}

// Singleton-Instanz – einfach importieren und nutzen:
// import { routerHelper, RoutePath } from '@/helper/routerHelper'
// routerHelper.goTo(RoutePath.Dashboard)
export const routerHelper = new RouterHelper()
