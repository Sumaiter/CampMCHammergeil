<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RoutePath } from '@/router/routePath'
import { useAuth } from '@/auth/useAuth'

// Der Shop ist nur für eingeloggte Benutzer sichtbar
const { user } = useAuth()

const startDateZelt = new Date('2026-06-05T00:00:00') // ende von rar 2026
const endDateZelt = new Date('2027-06-02T00:00:00')
const endDateFestival = new Date('2027-06-04T00:00:00')

// Kartenkoordinaten (SVG-viewBox) – alles skaliert mit der Breite der Karte
const VIEW_WIDTH = 400
const VIEW_HEIGHT = 555
const HOME = { x: 200, y: 50 }
const CAMP = { x: 200, y: 385 }
const FESTIVAL = { x: 200, y: 505 }

// Lange, kurvige Straße bis zum Camp, kurze Zufahrt vom Camp zur Bühne
const ROAD =
  'M200 50 C 200 100, 320 90, 320 145 C 320 205, 80 180, 80 240 C 80 290, 200 280, 200 385'
const DRIVEWAY = 'M200 385 C 200 435, 235 455, 200 505'

// Auto hält diesen Abstand zu den Stationsmitten, damit es die Icons nie verdeckt
const STATION_CLEARANCE = 46

// Linien-Icons, zentriert um (0, 0)
const ICONS = {
  home: 'M-12 1 L0 -10 L12 1 M-8.5 -2 V11 H8.5 V-2 M-3 11 V4 H3 V11',
  camp: 'M-15 11 L0 -11 L15 11 M-18 11 H18 M-5 11 L0 2 L5 11 M0 -11 V-16 L5.5 -14.2 L0 -12.4',
  festival:
    'M-17 11 H17 M-13 -6 V11 M13 -6 V11 M-15 -10 H15 M-15 -6 H15 ' +
    'M-15 -10 L-11 -6 L-7 -10 L-3 -6 L1 -10 L5 -6 L9 -10 L13 -6 ' +
    'M-10 11 V3 H-5 V11 M5 11 V3 H10 V11 M0 11 V1 M-1.8 -1.5 a1.8 1.8 0 1 0 3.6 0 a1.8 1.8 0 1 0 -3.6 0',
}

const now = ref(Date.now())
const roadPath = ref<SVGPathElement | null>(null)
const drivewayPath = ref<SVGPathElement | null>(null)

let interval: number | undefined

const pad = (value: number) => String(value).padStart(2, '0')
const dateFormat = new Intl.DateTimeFormat('de-DE', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const toPercentY = (y: number) => `${(y / VIEW_HEIGHT) * 100}%`

function getCountdown(target: Date) {
  const diff = target.getTime() - now.value

  if (diff <= 0) return null

  return {
    date: dateFormat.format(target),
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

function progressBetween(from: Date, to: Date) {
  const progress = (now.value - from.getTime()) / (to.getTime() - from.getTime())
  return Math.min(Math.max(progress, 0), 1)
}

const campStartZelt = computed(() => getCountdown(endDateZelt))
const campStartFestival = computed(() => getCountdown(endDateFestival))

// Jeder Abschnitt hat seinen eigenen Zeitraum: Straße bis zum Camp-Start,
// Zufahrt in den zwei Tagen zwischen Camp-Start und Festival-Start
const roadProgress = computed(() => progressBetween(startDateZelt, endDateZelt))
const drivewayProgress = computed(() => progressBetween(endDateZelt, endDateFestival))

const stations = computed(() => {
  const campReached = roadProgress.value >= 1
  const festivalReached = drivewayProgress.value >= 1
  return [
    { id: 'home', ...HOME, icon: ICONS.home, reached: true, next: false },
    { id: 'camp', ...CAMP, icon: ICONS.camp, reached: campReached, next: !campReached },
    {
      id: 'festival',
      ...FESTIVAL,
      icon: ICONS.festival,
      reached: festivalReached,
      next: campReached && !festivalReached,
    },
  ]
})

// Auto steht auf dem aktuellen Abschnitt und dreht sich in Fahrtrichtung
const car = computed(() => {
  const onDriveway = roadProgress.value >= 1
  const path = onDriveway ? drivewayPath.value : roadPath.value
  if (!path) return null

  const length = path.getTotalLength()
  const progress = onDriveway ? drivewayProgress.value : roadProgress.value
  const at = STATION_CLEARANCE + progress * (length - 2 * STATION_CLEARANCE)
  const point = path.getPointAtLength(at)
  const behind = path.getPointAtLength(Math.max(at - 1, 0))
  const ahead = path.getPointAtLength(Math.min(at + 1, length))

  return {
    x: point.x,
    y: point.y,
    angle: (Math.atan2(ahead.y - behind.y, ahead.x - behind.x) * 180) / Math.PI,
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
      <svg
        class="map"
        :viewBox="`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`"
        role="img"
        aria-label="Route von Zuhause über das Camp zum Festival"
      >
        <defs>
          <filter id="route-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="car-beam" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stop-color="#fff6cf" stop-opacity="0.5" />
            <stop offset="1" stop-color="#fff6cf" stop-opacity="0" />
          </linearGradient>
        </defs>

        <!-- Straße Zuhause → Camp -->
        <path class="road-edge" :d="ROAD" />
        <path ref="roadPath" class="road" :d="ROAD" />
        <path class="road-line" :d="ROAD" />
        <path
          v-if="roadProgress > 0"
          class="route-progress"
          :d="ROAD"
          pathLength="1"
          :stroke-dashoffset="1 - roadProgress"
          filter="url(#route-glow)"
        />

        <!-- Zufahrt Camp → Festival -->
        <path class="driveway-edge" :d="DRIVEWAY" />
        <path ref="drivewayPath" class="driveway" :d="DRIVEWAY" />
        <path class="driveway-line" :d="DRIVEWAY" />
        <path
          v-if="drivewayProgress > 0"
          class="route-progress"
          :d="DRIVEWAY"
          pathLength="1"
          :stroke-dashoffset="1 - drivewayProgress"
          filter="url(#route-glow)"
        />

        <!-- Stationen -->
        <g
          v-for="station in stations"
          :key="station.id"
          class="station"
          :class="{ reached: station.reached, next: station.next }"
          :transform="`translate(${station.x} ${station.y})`"
        >
          <circle v-if="station.next" class="station-pulse" r="27" />
          <circle class="station-ring" r="27" />
          <path class="station-icon" :d="station.icon" />
        </g>

        <!-- Auto (Draufsicht, zeigt nach rechts) -->
        <g v-if="car" class="car" :transform="`translate(${car.x} ${car.y}) rotate(${car.angle})`">
          <path class="car-beam" d="M15 -5 L52 -18 Q56 0 52 18 L15 5 Z" />
          <rect class="car-body" x="-15" y="-8.5" width="30" height="17" rx="6" />
          <rect class="car-glass" x="3" y="-7" width="7.5" height="14" rx="2.5" />
          <rect class="car-glass" x="-12.5" y="-6.5" width="5" height="13" rx="2" />
          <circle class="car-light" cx="14.2" cy="-5.2" r="1.5" />
          <circle class="car-light" cx="14.2" cy="5.2" r="1.5" />
          <rect class="car-tail" x="-15.6" y="-7" width="1.8" height="3.5" rx="0.8" />
          <rect class="car-tail" x="-15.6" y="3.5" width="1.8" height="3.5" rx="0.8" />
        </g>
      </svg>

      <!-- Beschriftungen neben den Stationen -->
      <div class="home-caption" :style="{ top: toPercentY(HOME.y) }">
        <strong>Zuhause</strong>
      </div>

      <router-link
        v-if="user"
        :to="RoutePath.Shop"
        class="shop-link"
        :style="{ top: toPercentY(CAMP.y) }"
      >
        <svg class="shop-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M2.5 4h2.2l2.3 10.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L19.8 8H5.6" />
          <circle cx="9.2" cy="19" r="1.4" />
          <circle cx="16.6" cy="19" r="1.4" />
        </svg>
        <span>Shop</span>
      </router-link>

      <div v-if="campStartZelt" class="countdown start" :style="{ top: toPercentY(CAMP.y) }">
        <span class="countdown-label">Camp-Start</span>
        <span class="countdown-date">{{ campStartZelt.date }}</span>
        <span class="countdown-days">
          {{ campStartZelt.days }}
          <small>{{ campStartZelt.days === 1 ? 'Tag' : 'Tage' }}</small>
        </span>
        <span class="countdown-time">{{ campStartZelt.time }}</span>
      </div>

      <div v-if="campStartFestival" class="countdown end" :style="{ top: toPercentY(FESTIVAL.y) }">
        <span class="countdown-label">Festival-Start</span>
        <span class="countdown-date">{{ campStartFestival.date }}</span>
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
// Abstand der Beschriftungen von der Kartenmitte (Station + etwas Luft), in % der Kartenbreite
$side: 60%;

.camp-map {
  padding: 0 var(--page-pad) clamp(2rem, 6vh, 4rem);
}

.map-stage {
  position: relative;
  width: 100%;
  max-width: 380px;
  margin: 0 auto;
}

.map {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}

/* 🛣️ STRASSE */
.road-edge,
.road,
.road-line,
.driveway-edge,
.driveway,
.driveway-line,
.route-progress {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.road-edge {
  stroke: rgba(120, 255, 200, 0.14);
  stroke-width: 30;
}

.road {
  stroke: #0b120f;
  stroke-width: 24;
}

.road-line {
  stroke: rgba(255, 255, 255, 0.28);
  stroke-width: 2;
  stroke-dasharray: 7 9;
}

.driveway-edge {
  stroke: rgba(120, 255, 200, 0.12);
  stroke-width: 18;
}

.driveway {
  stroke: #0b120f;
  stroke-width: 13;
}

.driveway-line {
  stroke: rgba(255, 255, 255, 0.3);
  stroke-width: 2.5;
  stroke-dasharray: 0.5 7;
}

.route-progress {
  stroke: var(--c-accent);
  stroke-width: 4;
  stroke-dasharray: 1 1;
}

/* 📍 STATIONEN */
.station {
  .station-ring {
    fill: #07100c;
    stroke: rgba(238, 244, 241, 0.25);
    stroke-width: 2;
  }

  .station-icon {
    fill: none;
    stroke: rgba(238, 244, 241, 0.7);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  &.reached .station-ring,
  &.next .station-ring {
    stroke: var(--c-accent);
    filter: url(#route-glow);
  }

  &.reached .station-icon {
    stroke: var(--c-accent);
  }

  .station-pulse {
    fill: none;
    stroke: var(--c-accent);
    stroke-width: 2;
    transform-box: fill-box;
    transform-origin: center;
    animation: pulse 2.4s ease-out infinite;
  }
}

/* 🚗 AUTO */
.car {
  .car-beam {
    fill: url(#car-beam);
  }

  .car-body {
    fill: #effff8;
    stroke: var(--c-accent);
    stroke-width: 1;
  }

  .car-glass {
    fill: #0b2a1e;
  }

  .car-light {
    fill: #fff6cf;
  }

  .car-tail {
    fill: #ff4d6d;
  }
}

/* 🏷️ BESCHRIFTUNGEN */
.home-caption,
.shop-link,
.countdown {
  position: absolute;
  z-index: 2;
  transform: translateY(-50%);
}

.home-caption {
  right: $side;
  display: flex;
  flex-direction: column;
  text-align: right;
  line-height: 1.25;

  strong {
    font-size: 0.95rem;
  }
}

.shop-link {
  left: $side;

  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 16px 0 12px;

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

  .shop-icon {
    width: 22px;
    height: 22px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  &:hover {
    background: rgba(120, 255, 200, 0.22);
    box-shadow: var(--glow);
    transform: translateY(calc(-50% - 2px));
  }
}

/* ⏳ COUNTDOWNS */
.countdown {
  display: flex;
  flex-direction: column;
  width: calc(100% - #{$side} - 2px);
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
    right: $side;
    text-align: right;
  }

  &.end {
    left: $side;
  }

  .countdown-label {
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--c-accent);
  }

  .countdown-date {
    font-size: 0.72rem;
    color: var(--c-text-muted);
  }

  .countdown-days {
    margin-top: 4px;
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

/* Auf breiten Bildschirmen dürfen die Karten über die Karte hinausragen */
@media (min-width: 640px) {
  .countdown {
    width: 210px;
  }
}

@keyframes pulse {
  0% {
    opacity: 0.8;
    transform: scale(1);
  }

  100% {
    opacity: 0;
    transform: scale(1.6);
  }
}
</style>
