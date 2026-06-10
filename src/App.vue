<script setup lang="ts">
import Logo from './components/Logo.vue'
import FogCanvas from './components/FogCanvas.vue'
import CampMap from './components/CampMap.vue'
</script>

<template>
  <FogCanvas />

  <div class="app-container">
    <div class="page">
      <Logo />
      <CampMap />
      <!-- Todo <impressum /> -->
    </div>
  </div>
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
