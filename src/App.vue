<template>
  <FogCanvas />

  <Cookie />

  <div class="page">
    <Logo />

    <router-view />
  </div>

  <Footer />
</template>

<script setup lang="ts">
import Cookie from './components/CookieConsent/CookieConsent.vue'
import Footer from './components/Footer/Footer.vue'
import Logo from './components/Logo.vue'
import FogCanvas from './components/FogCanvas.vue'
</script>

<style scoped>
:global(html, body) {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  background: #111;
  overflow-x: hidden;
}

/* 🔧 NUR ABSTAND FIX — sonst alles gleich */
.page {
  width: 100%;
  min-height: auto; /* wichtig */
  display: block;
  padding: 0;
}
</style>
