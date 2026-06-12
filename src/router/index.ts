import { createRouter, createWebHistory } from 'vue-router'

import CampMap from '@/components/CampMap.vue'
import Datenschutz from '@/components/Footer/Datenschutz.vue'
import Impressum from '@/components/Footer/Impressum.vue'
import Login from '@/components/Login/LoginView.vue'

const routes = [
  { path: '/', component: CampMap },
  { path: '/login', component: Login },
  { path: '/datenschutz', component: Datenschutz },
  { path: '/impressum', component: Impressum },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
