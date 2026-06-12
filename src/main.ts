import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

import PowerGlitchPlugin from 'vue-powerglitch'

const app = createApp(App)

app.use(router)
app.use(PowerGlitchPlugin)

app.mount('#app')
