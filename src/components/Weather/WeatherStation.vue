<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { forecastDays, staleLabel, useWeather } from '@/weather/useWeather'
import { weatherEmoji } from '@/weather/emoji'

const { weather, effectsEnabled, now, setEffectsEnabled, start } = useWeather()

const open = ref(false)
const root = ref<HTMLElement | null>(null)

const current = computed(() => weather.value?.current)
const temperature = computed(() =>
  current.value ? `${Math.round(current.value.temperature)}°` : '–°',
)
const emoji = computed(() =>
  current.value ? weatherEmoji(current.value.condition, current.value.isDay) : '🌡️',
)
const stale = computed(() => (weather.value ? staleLabel(weather.value, now.value) : null))
const days = computed(() => (weather.value ? forecastDays(weather.value, now.value) : []))

const onDocumentClick = (event: MouseEvent) => {
  if (open.value && !root.value?.contains(event.target as Node)) open.value = false
}
const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') open.value = false
}

let stop: (() => void) | undefined

onMounted(() => {
  stop = start()
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  stop?.()
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="root" class="weather-station">
    <button
      type="button"
      class="station"
      :aria-expanded="open"
      aria-controls="weather-forecast"
      aria-label="Wetter am Nürburgring"
      @click="open = !open"
    >
      <span class="station-icon" aria-hidden="true">{{ emoji }}</span>
      <span class="station-temp">{{ temperature }}</span>
      <span class="station-label">Nürburgring</span>
      <span v-if="stale" class="station-stale">{{ stale }}</span>
    </button>

    <button
      type="button"
      role="switch"
      class="effects-switch"
      :aria-checked="effectsEnabled"
      @click="setEffectsEnabled(!effectsEnabled)"
    >
      <span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span>
      Effekte
    </button>

    <Transition name="fade">
      <div v-if="open" id="weather-forecast" class="forecast glass-card">
        <p v-if="!days.length" class="forecast-empty">Noch keine Wetterdaten.</p>
        <ul v-else>
          <li v-for="day in days" :key="day.date">
            <span class="day">{{ day.label }}</span>
            <span aria-hidden="true">{{ weatherEmoji(day.condition) }}</span>
            <span class="temps">{{ Math.round(day.max) }}° / {{ Math.round(day.min) }}°</span>
            <span class="rain">{{ day.rainChance !== null ? `💧 ${day.rainChance} %` : '' }}</span>
          </li>
        </ul>
      </div>
    </Transition>
  </div>
</template>

<style scoped lang="scss">
/* 🌦️ WETTERSTATION – Gegenstück zum Login-Satelliten */
.weather-station {
  position: absolute;
  top: max(12px, env(safe-area-inset-top));
  left: max(12px, env(safe-area-inset-left));
  z-index: 10;

  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.station {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 8px;
  border: 0;
  border-radius: var(--radius-sm);
  background: none;

  color: var(--c-text);
  font: inherit;
  cursor: pointer;
  user-select: none;
  transition: transform 0.25s ease;

  .station-icon {
    font-size: clamp(1.7rem, 5.5vw, 2.3rem);
    line-height: 1;
  }

  .station-temp {
    font-size: 1rem;
    font-weight: 700;
    line-height: 1.2;
  }

  .station-label,
  .station-stale {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--c-text-muted);
    transition: color 0.2s ease;
  }

  .station-stale {
    font-size: 0.62rem;
    letter-spacing: 0.08em;
  }

  &:hover,
  &[aria-expanded='true'] {
    transform: translateY(-2px);

    .station-label {
      color: var(--c-accent);
    }
  }
}

.effects-switch {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 4px;
  border: 0;
  background: none;

  color: var(--c-text-muted);
  font: inherit;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;

  .switch-track {
    position: relative;
    width: 26px;
    height: 14px;
    border: 1px solid var(--c-border-strong);
    border-radius: 999px;
    background: var(--c-surface);
    transition: background 0.2s ease;
  }

  .switch-thumb {
    position: absolute;
    top: 1px;
    left: 1px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--c-text-muted);
    transition:
      transform 0.2s ease,
      background 0.2s ease;
  }

  &[aria-checked='true'] {
    color: var(--c-accent);

    .switch-track {
      background: var(--c-accent-deep);
    }

    .switch-thumb {
      transform: translateX(12px);
      background: var(--c-accent);
    }
  }
}

.forecast {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 6px;
  padding: 0.75rem 1rem;
  min-width: 15rem;

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: grid;
    grid-template-columns: 3.2rem 1.6rem 1fr auto;
    align-items: center;
    gap: 0.4rem;
    padding: 0.3rem 0;
    font-size: 0.9rem;

    & + li {
      border-top: 1px solid var(--c-border);
    }
  }

  .day {
    font-weight: 700;
  }

  .rain {
    color: var(--c-text-muted);
    font-size: 0.8rem;
  }
}

.forecast-empty {
  margin: 0;
  color: var(--c-text-muted);
}

.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
