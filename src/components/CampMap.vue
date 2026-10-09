<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RoutePath } from '@/router/routePath'
import festivalImg from '../pics/festival.png'

const startDateZelt = new Date('2026-06-05T00:00:00') // ende von rar 2026
const endDateZelt = new Date('2027-06-02T00:00:00')
const endDateFestival = new Date('2027-06-04T00:00:00')

// Geometrie der gestrichelten Strecke: SVG-viewBox 100×400, gezeichnet in 120×400 px
const TRACK_WIDTH = 120
const TRACK_TOP = 60
const TRACK_SCALE_X = TRACK_WIDTH / 100

const now = ref(Date.now())
const trackPath = ref<SVGPathElement | null>(null)

let interval: number | undefined

const pad = (value: number) => String(value).padStart(2, '0')

function getCountdown(target: Date) {
  const diff = target.getTime() - now.value

  if (diff <= 0) return null

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    time: [
      Math.floor((diff / (1000 * 60 * 60)) % 24),
      Math.floor((diff / (1000 * 60)) % 60),
      Math.floor((diff / 1000) % 60),
    ]
      .map(pad)
      .join(':'),
  }
}

const campStartZelt = computed(() => getCountdown(endDateZelt))
const campStartFestival = computed(() => getCountdown(endDateFestival))

// Auto fährt anteilig zur vergangenen Zeit von Haus (Start) bis Festival (Ende)
const carStyle = computed(() => {
  const path = trackPath.value
  if (!path) return { display: 'none' }

  const start = startDateZelt.getTime()
  const end = endDateFestival.getTime()
  const progress = Math.min(Math.max((now.value - start) / (end - start), 0), 1)
  const point = path.getPointAtLength(progress * path.getTotalLength())

  return {
    left: `calc(50% - ${TRACK_WIDTH / 2}px + ${point.x * TRACK_SCALE_X}px)`,
    top: `${TRACK_TOP + point.y}px`,
  }
})

onMounted(() => {
  interval = window.setInterval(() => {
    now.value = Date.now()
  }, 1000)
})

onUnmounted(() => {
  clearInterval(interval)
})
</script>

<template>
  <section class="camp-map" aria-label="Countdown bis zum Camp">
    <div class="map-stage">
      <!-- Haus -->
      <span class="station house" role="img" aria-label="Zuhause">🏠</span>

      <!-- Strecke -->
      <svg
        class="track"
        :style="{ width: `${TRACK_WIDTH}px`, top: `${TRACK_TOP}px` }"
        viewBox="0 0 100 400"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          ref="trackPath"
          d="
            M50 20
            C 90 60, 90 120, 50 180
            C 20 220, 30 270, 50 310
          "
        />
      </svg>

      <!-- Auto -->
      <div class="car" :style="carStyle" aria-hidden="true">🚗</div>

      <!-- Zelt + Shop -->
      <span class="station tent" role="img" aria-label="Camp">🏕️</span>

      <router-link :to="RoutePath.Shop" class="shop-link">
        <span aria-hidden="true">🛒</span>
        <span>Shop</span>
      </router-link>

      <div v-if="campStartZelt" class="countdown start">
        <span class="countdown-label">Camp-Start</span>
        <span class="countdown-days">
          {{ campStartZelt.days }}
          <small>{{ campStartZelt.days === 1 ? 'Tag' : 'Tage' }}</small>
        </span>
        <span class="countdown-time">{{ campStartZelt.time }}</span>
      </div>

      <!-- Festival -->
      <img :src="festivalImg" class="festival" alt="Festival" width="64" height="64" />

      <div v-if="campStartFestival" class="countdown end">
        <span class="countdown-label">Festival-Start</span>
        <span class="countdown-days">
          {{ campStartFestival.days }}
          <small>{{ campStartFestival.days === 1 ? 'Tag' : 'Tage' }}</small>
        </span>
        <span class="countdown-time">{{ campStartFestival.time }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
$station-size: 4rem;
$side-gap: 48px; // Abstand von der Mitte zu Shop-Button und Countdown-Karten

.camp-map {
  padding: 0 var(--page-pad) clamp(2rem, 6vh, 4rem);
}

.map-stage {
  position: relative;
  width: 100%;
  max-width: 620px;
  height: 440px;
  margin: 0 auto;
}

.station {
  position: absolute;
  left: 50%;
  z-index: 5;
  transform: translateX(-50%);
  font-size: $station-size;
  line-height: 1.2;
  filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.45));
}

.house {
  top: 20px;
}

.tent {
  top: 200px;
}

.festival {
  position: absolute;
  top: 340px;
  left: 50%;
  z-index: 5;
  width: $station-size;
  height: auto;
  transform: translateX(-50%);
  filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.45));
}

.track {
  position: absolute;
  left: 50%;
  z-index: 1;
  height: 400px;
  transform: translateX(-50%);
  pointer-events: none;

  path {
    fill: none;
    stroke: rgba(255, 255, 255, 0.75);
    stroke-width: 5;
    stroke-dasharray: 10 8;
    stroke-linecap: round;
  }
}

/* Auto immer ganz oben */
.car {
  position: absolute;
  z-index: 10;
  font-size: 1.8rem;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

/* 🛒 SHOP */
.shop-link {
  position: absolute;
  top: 218px;
  left: calc(50% + #{$side-gap});
  z-index: 6;

  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 14px 0 10px;

  border: 1px solid var(--c-border-strong);
  border-radius: 999px;
  background: rgba(120, 255, 200, 0.12);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);

  font-size: 0.9rem;
  font-weight: 700;
  color: var(--c-accent);
  text-decoration: none;
  transition:
    background 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;

  span:first-child {
    font-size: 1.3rem;
  }

  &:hover {
    background: rgba(120, 255, 200, 0.22);
    box-shadow: var(--glow);
    transform: translateY(-2px);
  }
}

/* ⏳ COUNTDOWNS */
.countdown {
  position: absolute;
  z-index: 6;
  display: flex;
  flex-direction: column;
  width: min(210px, calc(50% - #{$side-gap} - 4px));
  padding: 10px clamp(10px, 2.5vw, 14px);

  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: 14px;
  box-shadow: var(--shadow-card);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);

  font-variant-numeric: tabular-nums;
  line-height: 1.2;

  &.start {
    top: 196px;
    right: calc(50% + #{$side-gap});
    text-align: right;
  }

  &.end {
    top: 330px;
    left: calc(50% + #{$side-gap});
  }

  .countdown-label {
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--c-accent);
  }

  .countdown-days {
    margin-top: 2px;
    font-size: clamp(1.25rem, 6vw, 2rem);
    font-weight: 800;
    color: #fff;
    white-space: nowrap;

    small {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--c-text-muted);
    }
  }

  .countdown-time {
    font-size: clamp(0.85rem, 3vw, 1rem);
    color: var(--c-text-muted);
  }
}
</style>
