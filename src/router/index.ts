import { createRouter, createWebHistory } from 'vue-router'
import { RoutePath } from './routePath'
import CampMap from '@/components/CampMap.vue'

// Startseite wird direkt geladen, alle anderen Seiten erst bei Bedarf (kleineres Start-Bundle).
const routes = [
  { path: RoutePath.Home, component: CampMap },
  { path: RoutePath.Login, component: () => import('@/components/Login/LoginView.vue') },
  {
    path: RoutePath.PrivacyPolicy,
    component: () => import('@/components/Footer/DatenschutzPage.vue'),
  },
  { path: RoutePath.Imprint, component: () => import('@/components/Footer/ImpressumPage.vue') },
  { path: RoutePath.Credits, component: () => import('@/components/Footer/CreditsPage.vue') },
  { path: RoutePath.Shop, component: () => import('@/components/Shop/ShopChoose.vue') },
  { path: RoutePath.Shopping, component: () => import('@/components/Shop/ShoppingPage.vue') },
  { path: RoutePath.ShoppingList, component: () => import('@/components/Shop/ShoppingList.vue') },
  {
    path: RoutePath.ShoppingOverview,
    component: () => import('@/components/Shop/ShoppingOverview.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  // Nach einem Seitenwechsel oben starten, bei Zurück/Vor die alte Position wiederherstellen.
  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition ?? { top: 0 }
  },
})

export default router
