<template>
  <div v-if="visible" class="cookie-bar">
    <div class="inner">
      <div class="text">
        <h3>Cookie-Einstellungen</h3>

        <p>
          Diese Website verwendet nur technisch notwendige Cookies und vergleichbare Technologien
          für Betrieb, Sicherheit und Performance. Optionale Cookies werden nicht eingesetzt.
        </p>

        <div class="category">
          <h4>Essentiell</h4>
          <p>Notwendig für den Betrieb der Website</p>

          <p class="active">Immer aktiv</p>

          <ul>
            <li>Speicherung deiner Cookie-Einstellungen (localStorage)</li>
            <li>Website-Funktion (Vue Router Navigation)</li>
            <li>Sicherheits- und Performancefunktionen durch Cloudflare</li>
          </ul>
        </div>
      </div>

      <div class="buttons">
        <button class="decline" @click="decline">Alle ablehnen</button>

        <button class="accept" @click="accept">Alle akzeptieren</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const visible = ref(false)

const KEY = 'cookie_choice_v1'

onMounted(() => {
  const saved = localStorage.getItem(KEY)
  if (!saved) {
    visible.value = true
  }
})

const accept = () => {
  localStorage.setItem(KEY, JSON.stringify({ accepted: true }))
  visible.value = false
}

const decline = () => {
  localStorage.setItem(KEY, JSON.stringify({ accepted: false }))
  visible.value = false
}
</script>

<style scoped>
.cookie-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  z-index: 9999;

  background: rgba(0, 0, 0, 0.88);
  backdrop-filter: blur(10px);
  color: white;

  padding: 1rem;
  border-top: 1px solid rgba(120, 255, 200, 0.2);
}

.inner {
  max-width: 950px;
  margin: 0 auto;

  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 2rem;
}

.text {
  max-width: 700px;
}

h3 {
  margin: 0 0 0.5rem 0;
  color: #78ffc8;
}

h4 {
  margin-top: 1rem;
  margin-bottom: 0.3rem;
  color: #78ffc8;
}

p {
  font-size: 0.85rem;
  line-height: 1.4;
  opacity: 0.9;
}

.active {
  font-size: 0.75rem;
  color: #78ffc8;
  margin-top: 0.3rem;
}

ul {
  margin: 0.5rem 0;
  padding-left: 1.2rem;
  font-size: 0.8rem;
  opacity: 0.85;
}

.buttons {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 160px;
}

button {
  padding: 0.7rem 1rem;
  border-radius: 6px;
  font-weight: bold;
  cursor: pointer;
  border: none;
  transition: 0.2s;
}

.accept {
  background: #78ffc8;
  color: black;
}

.decline {
  background: transparent;
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

button:hover {
  opacity: 0.85;
  transform: scale(1.03);
}
</style>
