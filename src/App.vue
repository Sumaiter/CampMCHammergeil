<template>
  <SpaceBackground />

  <CookieConsent />

  <div class="app-layout">
    <SiteHeader />
    <main class="page">
      <router-view />
    </main>
    <SiteFooter />
  </div>
</template>

<script setup lang="ts">
import CookieConsent from './components/CookieConsent/CookieConsent.vue'
import SiteFooter from './components/Footer/SiteFooter.vue'
import SiteHeader from './components/SiteHeader.vue'
import SpaceBackground from './components/SpaceBackground.vue'
</script>

<style scoped lang="scss">
.app-layout {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100dvh;
}

.page {
  flex: 1;
  width: 100%;
}
</style>
