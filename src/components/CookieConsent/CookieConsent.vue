<template>
  <Transition name="slide-up">
    <section
      v-if="visible"
      class="cookie-bar"
      role="dialog"
      aria-labelledby="cookie-title"
      aria-describedby="cookie-text"
    >
      <div class="inner">
        <div class="text">
          <h3 id="cookie-title">🍪 Cookie-Einstellungen</h3>

          <p id="cookie-text">
            Diese Website verwendet nur technisch notwendige Cookies und vergleichbare Technologien
            für Betrieb, Sicherheit und Performance. Optionale Cookies werden nicht eingesetzt.
          </p>

          <div class="category">
            <div class="category-head">
              <h4>Essentiell</h4>
              <span class="active">Immer aktiv</span>
            </div>
            <p>Notwendig für den Betrieb der Website</p>

            <ul>
              <li>Speicherung deiner Cookie-Einstellungen (localStorage)</li>
              <li>Website-Funktion (Vue Router Navigation)</li>
              <li>Sicherheits- und Performancefunktionen durch Cloudflare</li>
              <li>Login-Session-Cookie (nur nach Anmeldung)</li>
            </ul>
          </div>
        </div>

        <div class="buttons">
          <button type="button" class="decline" @click="decline">Alle ablehnen</button>
          <button type="button" class="accept" @click="accept">Alle akzeptieren</button>
        </div>
      </div>
    </section>
  </Transition>
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

<style scoped lang="scss">
.cookie-bar {
  position: fixed;
  left: 50%;
  bottom: max(12px, env(safe-area-inset-bottom));
  z-index: 9999;
  transform: translateX(-50%);

  width: min(960px, calc(100% - 24px));
  max-height: calc(100dvh - 24px);
  overflow-y: auto;
  padding: clamp(1rem, 3vw, 1.5rem);

  background: var(--c-surface-strong);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  box-shadow: 0 -8px 50px rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  color: var(--c-text);
}

.inner {
  display: flex;
  align-items: flex-end;
  gap: clamp(1rem, 3vw, 2rem);
}

.text {
  flex: 1;
  min-width: 0;

  h3 {
    margin-bottom: 0.4rem;
    font-size: 1.05rem;
    color: var(--c-accent);
  }

  p {
    font-size: 0.85rem;
    line-height: 1.5;
    color: var(--c-text-muted);
  }
}

.category {
  margin-top: 0.85rem;
  padding: 0.75rem 0.9rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.03);

  .category-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.2rem;
  }

  h4 {
    font-size: 0.9rem;
    color: var(--c-text);
  }

  .active {
    padding: 2px 8px;
    border-radius: 999px;
    background: rgba(120, 255, 200, 0.14);
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--c-accent);
    white-space: nowrap;
  }

  ul {
    margin: 0.4rem 0 0;
    padding-left: 1.1rem;
    font-size: 0.8rem;
    line-height: 1.5;
    color: var(--c-text-muted);
  }
}

.buttons {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  min-width: 180px;

  button {
    min-height: 44px;
    padding: 0.65rem 1rem;
    border-radius: var(--radius-sm);
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
    transition:
      transform 0.15s ease,
      filter 0.15s ease,
      background 0.15s ease;

    &:hover {
      transform: translateY(-1px);
    }

    &:active {
      transform: translateY(0);
    }
  }

  .accept {
    border: none;
    background: var(--c-accent);
    color: #04140d;

    &:hover {
      filter: brightness(1.08);
    }
  }

  .decline {
    border: 1px solid rgba(255, 255, 255, 0.3);
    background: transparent;
    color: var(--c-text);

    &:hover {
      background: rgba(255, 255, 255, 0.06);
    }
  }
}

/* 📱 MOBILE: Text oben, Buttons nebeneinander darunter */
@media (max-width: 640px) {
  .inner {
    flex-direction: column;
    align-items: stretch;
  }

  .buttons {
    flex-direction: row;
    min-width: 0;

    button {
      flex: 1;
    }
  }
}

/* Ein-/Ausblenden */
.slide-up-enter-active,
.slide-up-leave-active {
  transition:
    transform 0.35s ease,
    opacity 0.35s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translate(-50%, 24px);
}
</style>
