import { createRouter, createWebHistory } from 'vue-router'

import CampMap from '@/components/CampMap.vue'
import Datenschutz from '@/components/Footer/Datenschutz.vue'
import Impressum from '@/components/Footer/Impressum.vue'
import Login from '@/components/Login/LoginView.vue'
import ShopChoose from '@/components/Shop/ShopChoose.vue'
import Shopping from '@/components/Shop/Shopping.vue'
import ShoppingList from '@/components/Shop/ShoppingList.vue'
import ShoppingOverview from '@/components/Shop/ShoppingOverview.vue'

const routes = [
  { path: '/', component: CampMap },
  { path: '/login', component: Login },
  { path: '/datenschutz', component: Datenschutz },
  { path: '/impressum', component: Impressum },
  { path: '/shop', component: ShopChoose },
  { path: '/shopping', component: Shopping },
  { path: '/shoppinglist', component: ShoppingList },
  { path: '/shoppingoverview', component: ShoppingOverview },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
