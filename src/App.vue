<script setup lang="ts">
import Cookie from './components/CookieConsent/CookieConsent.vue'
import Footer from './components/Footer/Footer.vue'
import Logo from './components/Logo.vue'
import FogCanvas from './components/FogCanvas.vue'
</script>

<template>
  <FogCanvas />

  <Cookie />

  <div class="page">
    <Logo />

    <!-- WICHTIG: Router Pages -->
    <router-view />
  </div>

  <Footer />
</template>

<style scoped>
:global(html, body) {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  background: #111;
  overflow-x: hidden;
}

.page {
  min-height: 100vh;
  width: 100%;
  background: transparent;

  display: flex;
  flex-direction: column;
  align-items: center;

  padding: 4vh 4vw;
  box-sizing: border-box;
  position: relative;
  z-index: 1;
}
</style>
