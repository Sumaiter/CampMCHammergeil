import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

import PowerGlitchPlugin from 'vue-powerglitch'

import '@fontsource/metal-mania'
import './styles/main.scss'

const app = createApp(App)

app.use(router)
app.use(PowerGlitchPlugin)

app.mount('#app')
