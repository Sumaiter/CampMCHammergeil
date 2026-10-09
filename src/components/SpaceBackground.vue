<template>
  <div class="space" aria-hidden="true">
    <canvas ref="nebulaCanvas" class="nebula" :class="{ ready: nebulaReady }"></canvas>
    <canvas ref="starCanvas" class="stars"></canvas>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

// Ein Stern pro ~3.200 px² (Desktop ≈ 400, Smartphone ≈ 100)
const AREA_PER_STAR = 3200
const MAX_STARS = 420
const MAX_PIXEL_RATIO = 2
const SHOOTING_STAR_PAUSE = [6, 14] // Sekunden zwischen Sternschnuppen
// Funkeln ist langsam – 30 Bilder/s reichen; nur Sternschnuppen laufen mit voller Bildrate
const TWINKLE_FRAME_MS = 33

const nebulaCanvas = ref<HTMLCanvasElement | null>(null)
const starCanvas = ref<HTMLCanvasElement | null>(null)
const nebulaReady = ref(false)

let stop: (() => void) | undefined

const random = (min: number, max: number) => min + Math.random() * (max - min)

// ---------- Nebel: einmal in niedriger Auflösung berechnen, per CSS hochskalieren ----------

function createNoise() {
  const perm = new Uint8Array(512)
  const values = Array.from({ length: 256 }, (_, i) => i).sort(() => Math.random() - 0.5)
  for (let i = 0; i < 512; i++) perm[i] = values[i & 255]!

  const hash = (x: number, y: number) => perm[(perm[x & 255]! + y) & 255]! / 255
  const smooth = (t: number) => t * t * (3 - 2 * t)

  const noise = (x: number, y: number) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const u = smooth(x - xi)
    const v = smooth(y - yi)
    const top = hash(xi, yi) + (hash(xi + 1, yi) - hash(xi, yi)) * u
    const bottom = hash(xi, yi + 1) + (hash(xi + 1, yi + 1) - hash(xi, yi + 1)) * u
    return top + (bottom - top) * v
  }

  return (x: number, y: number, octaves = 5) => {
    let value = 0
    let amplitude = 0.5
    for (let i = 0; i < octaves; i++) {
      value += amplitude * noise(x, y)
      x = x * 2.03 + 17.1
      y = y * 2.03 + 9.7
      amplitude *= 0.5
    }
    return value
  }
}

// Rechnet zeilenweise in kleinen Häppchen, damit der Seitenaufbau nie blockiert.
// Gibt eine Abbruch-Funktion zurück.
function renderNebula(canvas: HTMLCanvasElement, onDone: () => void) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}

  const width = Math.round(Math.min(Math.max(window.innerWidth / 5, 120), 300))
  const height = Math.round((width * window.innerHeight) / window.innerWidth)
  const fbm = createNoise()
  const image = ctx.createImageData(width, height)
  const scale = 3.2 / width
  let row = 0
  let timer = 0

  const renderRow = (y: number) => {
    for (let x = 0; x < width; x++) {
      const nx = x * scale
      const ny = y * scale
      // verwirbelte Schwaden (Domain Warping) + großflächige Maske für einzelne Nebelfelder
      const wx = fbm(nx + 3.1, ny + 7.4, 3)
      const wy = fbm(nx + 11.8, ny + 2.6, 3)
      const cloud = fbm(nx + wx * 2.2, ny + wy * 2.2)
      const mask = fbm(nx * 0.45 + 40, ny * 0.45 + 40, 3)

      const density = Math.max(0, cloud - 0.42) * 2.6 * Math.max(0, mask - 0.38) * 3.2
      const alpha = Math.min(density, 1) * 0.55

      // dunkles Petrol in den Rändern, Mintgrün in dichten Bereichen
      const t = Math.min(density, 1)
      const i = (y * width + x) * 4
      image.data[i] = 10 + t * 50
      image.data[i + 1] = 90 + t * 140
      image.data[i + 2] = 80 + t * 70
      image.data[i + 3] = alpha * 255
    }
  }

  const work = () => {
    const deadline = performance.now() + 8
    while (row < height && performance.now() < deadline) renderRow(row++)

    if (row < height) {
      timer = window.setTimeout(work, 0)
      return
    }
    canvas.width = width
    canvas.height = height
    ctx.putImageData(image, 0, 0)
    onDone()
  }

  work()
  return () => clearTimeout(timer)
}

// ---------- Sterne + Sternschnuppen ----------

interface Star {
  x: number // relativ zur Bildschirmbreite (0–1)
  y: number
  r: number
  alpha: number
  speed: number
  phase: number
  color: string
}

interface ShootingStar {
  x: number
  y: number
  vx: number
  vy: number
  length: number
  age: number
  life: number
}

function createStars(count: number): Star[] {
  return Array.from({ length: count }, () => {
    const bright = Math.random() < 0.08
    const tint = Math.random()
    return {
      x: Math.random(),
      y: Math.random(),
      r: bright ? random(1.1, 1.7) : random(0.35, 1),
      alpha: bright ? random(0.75, 1) : random(0.25, 0.75),
      speed: random(0.4, 1.8),
      phase: random(0, Math.PI * 2),
      color: tint < 0.15 ? '#aaffdc' : tint < 0.25 ? '#bed7ff' : '#ffffff',
    }
  }).sort((a, b) => a.color.localeCompare(b.color)) // gleiche Farben am Stück -> weniger Zustandswechsel
}

function createGlowSprite() {
  const sprite = document.createElement('canvas')
  sprite.width = sprite.height = 32
  const ctx = sprite.getContext('2d')
  if (ctx) {
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16)
    grad.addColorStop(0, 'rgba(200,255,230,0.5)')
    grad.addColorStop(1, 'rgba(200,255,230,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 32, 32)
  }
  return sprite
}

onMounted(() => {
  const canvas = starCanvas.value
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const stars = createStars(
    Math.min(Math.round((window.innerWidth * window.innerHeight) / AREA_PER_STAR), MAX_STARS),
  )
  const glow = createGlowSprite()
  let width = 0
  let height = 0
  let frame = 0
  let lastTime = performance.now()
  let shooting: ShootingStar | null = null
  let nextShooting = lastTime + random(2, 5) * 1000

  const resize = () => {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO)
    width = window.innerWidth
    height = window.innerHeight
    canvas.width = Math.round(width * pixelRatio)
    canvas.height = Math.round(height * pixelRatio)
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  }

  const spawnShootingStar = () => {
    const angle = random(0.35, 0.65) * (Math.random() < 0.5 ? 1 : -1) // flach nach unten
    const speed = random(700, 1000)
    const direction = Math.sign(angle)
    shooting = {
      x: random(0.15, 0.85) * width,
      y: random(0, 0.35) * height,
      vx: Math.cos(Math.abs(angle)) * speed * direction,
      vy: Math.sin(Math.abs(angle)) * speed,
      length: random(110, 190),
      age: 0,
      life: random(0.7, 1.1),
    }
  }

  const drawShootingStar = (s: ShootingStar) => {
    const fade = Math.sin(Math.PI * (s.age / s.life))
    const speed = Math.hypot(s.vx, s.vy)
    const tailX = s.x - (s.vx / speed) * s.length * fade
    const tailY = s.y - (s.vy / speed) * s.length * fade
    const grad = ctx.createLinearGradient(tailX, tailY, s.x, s.y)
    grad.addColorStop(0, 'rgba(120,255,200,0)')
    grad.addColorStop(1, `rgba(235,255,245,${0.9 * fade})`)
    ctx.strokeStyle = grad
    ctx.lineWidth = 1.6
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(tailX, tailY)
    ctx.lineTo(s.x, s.y)
    ctx.stroke()
    ctx.globalAlpha = fade
    ctx.drawImage(glow, s.x - 8, s.y - 8, 16, 16)
    ctx.globalAlpha = 1
  }

  const render = (time: number) => {
    const delta = Math.min((time - lastTime) / 1000, 0.05)
    lastTime = time
    const seconds = time / 1000

    ctx.clearRect(0, 0, width, height)

    for (const star of stars) {
      const twinkle = reduceMotion ? 1 : 0.6 + 0.4 * Math.sin(seconds * star.speed + star.phase)
      const x = star.x * width
      const y = star.y * height
      ctx.globalAlpha = star.alpha * twinkle

      if (star.r > 1.05) {
        ctx.drawImage(glow, x - star.r * 5, y - star.r * 5, star.r * 10, star.r * 10)
      }

      if (ctx.fillStyle !== star.color) ctx.fillStyle = star.color
      if (star.r < 0.9) {
        ctx.fillRect(x - star.r, y - star.r, star.r * 2, star.r * 2)
      } else {
        ctx.beginPath()
        ctx.arc(x, y, star.r, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1

    if (reduceMotion) return
    if (!shooting && time > nextShooting) spawnShootingStar()
    if (shooting) {
      shooting.age += delta
      shooting.x += shooting.vx * delta
      shooting.y += shooting.vy * delta
      drawShootingStar(shooting)
      if (shooting.age >= shooting.life) {
        shooting = null
        nextShooting = time + random(SHOOTING_STAR_PAUSE[0]!, SHOOTING_STAR_PAUSE[1]!) * 1000
      }
    }
  }

  const loop = (time: number) => {
    frame = requestAnimationFrame(loop)
    if (shooting || time - lastTime >= TWINKLE_FRAME_MS) render(time)
  }

  // Nebel nur bei geänderter Breite neu berechnen (Höhe ändert sich beim Scrollen auf dem Handy)
  let nebulaWidth = 0
  let nebulaTimer: number | undefined
  let cancelNebula = () => {}
  const updateNebula = () => {
    const nebula = nebulaCanvas.value
    if (!nebula || window.innerWidth === nebulaWidth) return
    nebulaWidth = window.innerWidth
    cancelNebula()
    cancelNebula = renderNebula(nebula, () => (nebulaReady.value = true))
  }

  const onResize = () => {
    resize()
    render(performance.now()) // Größenänderung leert das Canvas
    clearTimeout(nebulaTimer)
    nebulaTimer = window.setTimeout(updateNebula, 300)
  }

  resize()
  window.addEventListener('resize', onResize)
  if (reduceMotion) render(performance.now())
  else frame = requestAnimationFrame(loop)
  // Nebel nach dem ersten Bild berechnen, damit der Seitenaufbau nicht blockiert
  nebulaTimer = window.setTimeout(updateNebula, 50)

  stop = () => {
    cancelAnimationFrame(frame)
    clearTimeout(nebulaTimer)
    cancelNebula()
    window.removeEventListener('resize', onResize)
  }
})

onUnmounted(() => stop?.())
</script>

<style scoped lang="scss">
.space {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  background: radial-gradient(ellipse at 50% 0%, #0a1914 0%, var(--c-bg) 65%);
}

.nebula {
  position: absolute;
  inset: -10%;
  width: 120%;
  height: 120%;
  opacity: 0;
  transition: opacity 2s ease;
  animation: drift 120s ease-in-out infinite alternate;

  &.ready {
    opacity: 1;
  }
}

.stars {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

@keyframes drift {
  from {
    transform: translate(-3%, -2%) scale(1);
  }

  to {
    transform: translate(3%, 2%) scale(1.08);
  }
}
</style>
