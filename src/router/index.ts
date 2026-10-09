import { createRouter, createWebHistory } from 'vue-router'
import { RoutePath } from './routePath'
import { resolveNavigation } from './guard'
import { useAuth } from '@/auth/useAuth'
import CampMap from '@/components/CampMap.vue'

// Startseite wird direkt geladen, alle anderen Seiten erst bei Bedarf (kleineres Start-Bundle).
// meta.requiresAuth / requiresAdmin: nur mit Login bzw. als Admin erreichbar (siehe guard.ts).
const routes = [
  { path: RoutePath.Home, component: CampMap },
  { path: RoutePath.Login, component: () => import('@/components/Login/LoginView.vue') },
  {
    path: RoutePath.Account,
    component: () => import('@/components/Account/AccountPage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: RoutePath.Admin,
    component: () => import('@/components/Admin/AdminUsersPage.vue'),
    meta: { requiresAdmin: true },
  },
  {
    path: RoutePath.PrivacyPolicy,
    component: () => import('@/components/Footer/DatenschutzPage.vue'),
  },
  { path: RoutePath.Imprint, component: () => import('@/components/Footer/ImpressumPage.vue') },
  { path: RoutePath.Credits, component: () => import('@/components/Footer/CreditsPage.vue') },
  {
    path: RoutePath.Shop,
    component: () => import('@/components/Shop/ShopChoose.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: RoutePath.Shopping,
    component: () => import('@/components/Shop/ShoppingPage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: RoutePath.ShoppingList,
    component: () => import('@/components/Shop/ShoppingList.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: RoutePath.ShoppingOverview,
    component: () => import('@/components/Shop/ShoppingOverview.vue'),
    meta: { requiresAuth: true },
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

router.beforeEach(async (to) => {
  const auth = useAuth()
  await auth.ensureLoaded()
  return resolveNavigation(to, auth.user.value)
})

export default router
