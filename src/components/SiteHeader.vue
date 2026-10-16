<script setup lang="ts">
import { RoutePath } from '@/router/routePath'
import PlanetCanvas from './Planet/PlanetCanvas.vue'
import WeatherStation from './Weather/WeatherStation.vue'
import { useAuth } from '@/auth/useAuth'
import { useWeather } from '@/weather/useWeather'

const { user } = useAuth()
const { scene } = useWeather()

// Standard wäre alle 2 s ein Glitch – so nur kurz (~0,5 s) alle 8 s
const glitchOptions = {
  timing: { duration: 8000 },
  glitchTimeSpan: { start: 0.9, end: 0.96 },
}
</script>

<template>
  <header class="site-header">
    <!-- 🌦️ WETTER NÜRBURGRING -->
    <WeatherStation />

    <!-- 🛰️ LOGIN / KONTO -->
    <router-link
      :to="user ? RoutePath.Account : RoutePath.Login"
      class="satellite"
      :aria-label="user ? 'Konto' : 'Login'"
    >
      <span class="satellite-icon" aria-hidden="true">🛰️</span>
      <span class="satellite-label">{{ user ? user.username : 'Login' }}</span>
    </router-link>

    <!-- 🌍 PLANET -->
    <router-link :to="RoutePath.Home" class="planet" aria-label="Camp MC Hammergeil – Startseite">
      <PlanetCanvas :weather="scene" />

      <span class="text-layer">
        <GlitchedElement :options="glitchOptions">
          <span class="metal">
            Camp MC <br class="mobile-break" />
            Hammergeil
          </span>
        </GlitchedElement>
      </span>
    </router-link>
  </header>
</template>

<style scoped lang="scss">
.site-header {
  position: relative;
  display: flex;
  justify-content: center;
  padding: clamp(56px, 11vh, 110px) var(--page-pad) clamp(16px, 4vh, 48px);
  overflow-x: clip; // Flammen dürfen nach oben/unten, aber keinen horizontalen Scroll erzeugen
}

/* 🛰️ LOGIN-SATELLIT */
.satellite {
  position: absolute;
  top: max(12px, env(safe-area-inset-top));
  right: max(12px, env(safe-area-inset-right));
  z-index: 10;

  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 8px;
  border-radius: var(--radius-sm);

  color: var(--c-text);
  text-decoration: none;
  user-select: none;
  transition: transform 0.25s ease;

  .satellite-icon {
    font-size: clamp(2.2rem, 7vw, 3rem);
    line-height: 1;
    animation: drift 7s ease-in-out infinite;
  }

  .satellite-label {
    max-width: min(16rem, 45vw); // lange Namen umbrechen statt abschneiden
    overflow-wrap: anywhere;
    text-align: center;
    line-height: 1.3;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--c-text-muted);
    transition: color 0.2s ease;
  }

  &:hover,
  &.router-link-active {
    transform: translateY(-2px);

    .satellite-label {
      color: var(--c-accent);
    }
  }
}

/* 🌍 PLANET */
.planet {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  width: clamp(200px, 62vw, 270px);
  aspect-ratio: 1;
  border-radius: 50%;

  color: #fff;
  text-decoration: none;

  /* Fallback, falls WebGL nicht verfügbar ist – sonst verdeckt vom Planeten-Canvas */
  background: radial-gradient(
    circle at 30% 30%,
    #78ffc8 0%,
    #2aa87a 35%,
    #046c3c 70%,
    #012015 100%
  );
  box-shadow: 0 0 60px rgba(120, 255, 200, 0.15);

  transition: box-shadow 0.3s ease;

  &:hover {
    box-shadow: 0 0 90px rgba(120, 255, 200, 0.3);
  }

  &:focus-visible {
    outline-offset: 8px;
    border-radius: 50%;
  }

  .text-layer {
    position: absolute;
    inset: 0;
    z-index: 5;
    display: flex;
    justify-content: center;
    align-items: center;

    .metal {
      display: block;
      font-family: var(--font-display);
      font-size: clamp(2rem, 6vw, 5rem);
      line-height: 1.05;
      text-align: center;
      white-space: nowrap;
      color: #fff;
      text-shadow:
        0.05em 0.05em 0 #046c3c,
        0.1em 0.1em 0 #0a7f4a;
    }
  }
}

.mobile-break {
  display: none;
}

/* 📱 MOBILE: Titel zweizeilig */
@media (max-width: 600px) {
  .planet .text-layer .metal {
    font-size: min(4.2rem, 19vw);
  }

  .mobile-break {
    display: inline;
  }
}

@keyframes drift {
  0%,
  100% {
    transform: translate(0, 0) rotate(0deg);
  }

  50% {
    transform: translate(-3px, 4px) rotate(-6deg);
  }
}
</style>
