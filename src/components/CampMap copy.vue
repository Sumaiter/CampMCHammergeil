<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import festivalImg from '../pics/festival.png'

const campStartZelt = ref('')
const campStartFestival = ref('')

const startDateZelt = new Date('2026-06-05T00:00:00')
const endDateZelt = new Date('2027-06-02T00:00:00')
const startDateFestival = new Date('2027-06-02T09:00:00')
const endDateFestival = new Date('2027-06-04T00:00:00')

let interval: number

function formatCountdown(target: Date) {
  const diff = target.getTime() - Date.now()

  if (diff <= 0) return ''

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
  const minutes = Math.floor((diff / (1000 * 60)) % 60)
  const seconds = Math.floor((diff / 1000) % 60)

  return `${days} Tage ${hours} Stunden ${minutes} Minuten ${seconds} Sekunden`
}

function updateCountdowns() {
  campStartZelt.value = formatCountdown(endDateZelt)
  campStartFestival.value = formatCountdown(endDateFestival)
}

const carX = ref(0)
const carY = ref(0)

let path1: SVGPathElement | null = null
let pathLength = 0

function updateCar() {
  if (!path1) return

  const now = Date.now()
  const start = startDateZelt.getTime()
  const end = endDateZelt.getTime()

  // 0 → 1 Fortschritt der Zeit
  const progress = Math.min(Math.max((now - start) / (end - start), 0), 1)

  // 👉 DAS ist der entscheidende Teil:
  const point = path1.getPointAtLength(progress * pathLength)

  carX.value = point.x
  carY.value = point.y
}

onMounted(() => {
  path1 = document.querySelector('#path1')
  if (path1) {
    pathLength = path1.getTotalLength()
  }

  updateCar()
  updateCountdowns()
  interval = window.setInterval(updateCountdowns, 1000)
})

onUnmounted(() => {
  clearInterval(interval)
})
</script>

<template>
  <div class="map-wrapper">
    <!-- 🏠 Start -->
    <span class="house">🏠</span>

    <!-- Linie 1 -->
    <svg class="line line-1" viewBox="0 0 100 200" preserveAspectRatio="none">
      <path id="path1" d="M50 20 C 90 60, 90 120, 50 180" />
    </svg>

    <!-- Countdown Start -->
    <p v-if="campStartZelt" class="countdown start">
      {{ campStartZelt }}
    </p>

    <!-- ⛺ Zelt -->
    <span class="tent">🏕️</span>

    <!-- Linie 2 -->
    <svg class="line line-2" viewBox="0 0 100 100" preserveAspectRatio="none">
      <path d="M50 10 C 35 35, 35 65, 50 90" />
    </svg>

    <!-- 🎪 Festival -->
    <img :src="festivalImg" class="festival" />

    <!-- Countdown End -->
    <p v-if="campStartFestival" class="countdown end">
      {{ campStartFestival }}
    </p>

    <!-- 🚗 AUTO (zeitbasierte Position) -->
    <svg class="car-layer" viewBox="0 0 100 200" preserveAspectRatio="none">
      <!-- unsichtbarer Pfad (nur für Berechnung) -->
      <path id="path1" d="M50 20 C 90 60, 90 120, 50 180" fill="none" visibility="hidden" />

      <!-- Auto -->
      <g :transform="`translate(${carX}, ${carY})`">
        <text
          text-anchor="middle"
          dominant-baseline="middle"
          font-size="20"
          transform="scale(-1,1)"
        >
          🚗
        </text>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.map-wrapper {
  position: relative;
  width: 100%;
  max-width: 600px;
  height: 420px;
  margin: 0 auto;
}

/* Icons */
.house,
.tent {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-size: 4rem;
  z-index: 3;
}

.house {
  top: 20px;
}

.tent {
  top: 200px;
}

/* Festival */
.festival {
  position: absolute;
  top: 340px;
  left: 50%;
  transform: translateX(-50%);
  width: 4rem;
  z-index: 3;
}

/* Linien */
.line {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: 120px;
  pointer-events: none;
  z-index: 1;
}

.line-1 {
  top: 60px;
  height: 200px;
}

.line-2 {
  top: 270px;
  height: 100px;
}

.line path {
  fill: none;
  stroke: white;
  stroke-width: 5;
  stroke-dasharray: 10 8;
  stroke-linecap: round;
  opacity: 0.8;
}

/* Countdown */
.countdown {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  color: white;
  font-size: 0.9rem;
  text-align: center;
  width: 80%;
  z-index: 4;
}

.countdown.start {
  top: 120px;
}

.countdown.end {
  top: 380px;
}

/* 🚗 Layer */
.car-layer {
  position: absolute;
  top: 60px; /* genau Start von Linie 1 */
  left: 50%;
  transform: translateX(-50%);

  width: 120px;
  height: 200px;

  z-index: 5;
  pointer-events: none;
}
</style>
