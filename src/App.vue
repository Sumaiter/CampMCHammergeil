<template>
  <FogCanvas />

  <Cookie />

  <div class="app-layout">
    <div class="page">
      <Logo />
      <router-view />
    </div>

    <Footer />
  </div>
</template>

<script setup lang="ts">
import Cookie from './components/CookieConsent/CookieConsent.vue'
import Footer from './components/Footer/Footer.vue'
import Logo from './components/Logo.vue'
import FogCanvas from './components/FogCanvas.vue'
</script>

<style scoped>
:global(html, body, #app) {
  margin: 0;
  padding: 0;
  width: 100%;
  min-height: 100%;
  background: #111;
  overflow-x: hidden;
}

.page {
  flex: 1;
  width: 100%;
}

.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>
