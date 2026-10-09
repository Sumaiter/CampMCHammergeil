<script setup lang="ts">
import { RoutePath } from '@/router/routePath'

const year = new Date().getFullYear()

const links = [
  { to: RoutePath.Imprint, label: 'Impressum' },
  { to: RoutePath.PrivacyPolicy, label: 'Datenschutz' },
  { to: RoutePath.Credits, label: 'Quellen & Bildrechte' },
]
</script>

<template>
  <footer class="footer">
    <div class="footer-inner">
      <p class="brand">Camp MC Hammergeil</p>

      <nav class="links" aria-label="Rechtliches">
        <router-link v-for="link in links" :key="link.to" :to="link.to">
          {{ link.label }}
        </router-link>
      </nav>

      <p class="copy">© {{ year }}</p>
    </div>
  </footer>
</template>

<style scoped lang="scss">
.footer {
  width: 100%;
  padding: clamp(1.25rem, 4vh, 2rem) var(--page-pad)
    max(clamp(1.25rem, 4vh, 2rem), env(safe-area-inset-bottom));

  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0.7));
  border-top: 1px solid var(--c-border);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);

  text-align: center;
  color: var(--c-text);
}

.footer-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  max-width: 960px;
  margin: 0 auto;
}

.brand {
  font-family: var(--font-display);
  font-size: clamp(1.1rem, 3.5vw, 1.4rem);
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--c-accent);
}

.links {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.25rem 0.5rem;

  a {
    padding: 0.45rem 0.8rem;
    border-radius: 999px;
    font-size: 0.9rem;
    color: var(--c-text-muted);
    text-decoration: none;
    transition:
      color 0.2s ease,
      background 0.2s ease;

    &:hover {
      color: var(--c-accent);
      background: rgba(120, 255, 200, 0.08);
    }

    &.router-link-exact-active {
      color: var(--c-accent);
      background: rgba(120, 255, 200, 0.12);
    }
  }
}

.copy {
  font-size: 0.8rem;
  color: rgba(238, 244, 241, 0.45);
}
</style>
