import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'

import PowerGlitchPlugin from 'vue-powerglitch'

const app = createApp(App)

// Plugins registrieren
app.use(PowerGlitchPlugin)

app.mount('#app')
