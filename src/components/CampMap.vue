<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import festivalImg from '../pics/festival.png'

const router = useRouter()
const campStartZelt = ref('')
const campStartFestival = ref('')

const startDateZelt = new Date('2026-06-05T00:00:00') // ende von rar 2026
const endDateZelt = new Date('2027-06-02T00:00:00')
const endDateFestival = new Date('2027-06-04T00:00:00')
// const endDateFestival = new Date('2026-06-20T00:00:00')
// const endDateFestival = new Date('2026-06-12T00:00:00')
// const endDateFestival = new Date('2026-06-06T00:00:00')

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
  const end = endDateFestival.getTime()

  const progress = Math.min(Math.max((now - start) / (end - start), 0), 1)

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

  interval = window.setInterval(() => {
    updateCountdowns()
    updateCar()
  }, 1000)
})

onUnmounted(() => {
  clearInterval(interval)
})

const goShop = () => {
  router.push('/shop')
}
</script>

<template>
  <div class="map-wrapper">
    <!-- Haus -->
    <span class="house">🏠</span>

    <!-- Linie -->
    <svg class="line" viewBox="0 0 100 400" preserveAspectRatio="none">
      <path
        id="path1"
        d="
          M50 20
          C 90 60, 90 120, 50 180
          C 20 220, 30 270, 50 310
        "
      />
    </svg>

    <!-- Auto -->
    <div
      class="car"
      :style="{
        left: `calc(50% - 60px + ${carX * 1.2}px)`,
        top: `${60 + carY}px`,
      }"
    >
      🚗
    </div>

    <!-- Zelt -->
    <span class="tent">🏕️</span>
    <span class="shop" @click.stop="goShop">🛒</span>

    <p v-if="campStartZelt" class="countdown start">
      {{ campStartZelt }}
    </p>

    <!-- Festival -->
    <img :src="festivalImg" class="festival" />

    <p v-if="campStartFestival" class="countdown end">
      {{ campStartFestival }}
    </p>
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

/* Haus + Zelt */
.house,
.tent {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-size: 4rem;
  z-index: 5;
}

.house {
  top: 20px;
}

.tent {
  top: 200px;
}

.shop {
  position: absolute;
  top: 218px; /* gleiche Höhe wie Zelt */
  left: calc(50% + 65px); /* rechts daneben */
  transform: translateX(-50%) scale(0.5);

  font-size: 4rem; /* gleiche Basis wie andere Emojis */
  z-index: 5;
  cursor: pointer;
}

@media (max-width: 600px) {
  .shop {
    left: calc(50% + 55px);
    transform: translateX(-50%) scale(0.45);
  }
}

/* Festival */
.festival {
  position: absolute;
  top: 340px;
  left: 50%;
  transform: translateX(-50%);
  width: 4rem;
  z-index: 5;
}

/* Linie */
.line {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: 120px;
  height: 400px;
  top: 60px;

  z-index: 1;
  pointer-events: none;
}

.line path {
  fill: none;
  stroke: white;
  stroke-width: 5;
  stroke-dasharray: 10 8;
  stroke-linecap: round;
  opacity: 0.8;
}

/* Auto immer ganz oben */
.car {
  position: absolute;
  z-index: 10;

  font-size: 1.8rem;
  pointer-events: none;

  transform: translate(-50%, -50%);
}

/* Countdowns */
.countdown {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  color: white;
  font-size: 0.9rem;
  text-align: center;
  width: 80%;
  z-index: 6;
}

.countdown.start {
  top: 265px;
}

.countdown.end {
  top: 385px;
}
</style>
