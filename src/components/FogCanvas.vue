<template>
  <canvas ref="canvas" aria-hidden="true"></canvas>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const canvas = ref<HTMLCanvasElement | null>(null)

// Ein Nebelpartikel pro ~18.000 px² Bildschirmfläche (Desktop ≈ 70, Smartphone ≈ 20)
const AREA_PER_PARTICLE = 18000
const MIN_PARTICLES = 18
const MAX_PARTICLES = 70
const SPRITE_SIZE = 256

let width = 0
let height = 0
let stop: (() => void) | undefined

// Weicher Nebelfleck wird einmal vorgerendert und danach nur noch skaliert gezeichnet –
// deutlich günstiger als pro Frame und Partikel einen neuen Gradient zu erzeugen.
function createSprite() {
  const sprite = document.createElement('canvas')
  sprite.width = sprite.height = SPRITE_SIZE

  const ctx = sprite.getContext('2d')
  if (ctx) {
    const r = SPRITE_SIZE / 2
    const grad = ctx.createRadialGradient(r, r, 0, r, r, r)
    grad.addColorStop(0, 'rgba(255,255,255,0.08)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE)
  }

  return sprite
}

function resize() {
  const c = canvas.value
  if (!c || (c.width === window.innerWidth && c.height === window.innerHeight)) return

  // Nebel ist ohnehin unscharf – volle Geräte-Pixeldichte bringt hier nichts außer Last.
  width = c.width = window.innerWidth
  height = c.height = window.innerHeight
}

onMounted(() => {
  const ctx = canvas.value?.getContext('2d')
  if (!ctx) return

  resize()

  const sprite = createSprite()
  const count = Math.round(
    Math.min(Math.max((width * height) / AREA_PER_PARTICLE, MIN_PARTICLES), MAX_PARTICLES),
  )

  const particles = Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    r: Math.random() * 180 + 80,
    vx: (Math.random() - 0.5) * 0.25,
    vy: (Math.random() - 0.5) * 0.25,
  }))

  // Bei "Bewegung reduzieren" wird nur ein statisches Bild gezeichnet
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let animationId = 0

  const draw = () => {
    ctx.clearRect(0, 0, width, height)

    for (const p of particles) {
      ctx.drawImage(sprite, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2)

      p.x += p.vx
      p.y += p.vy

      if (p.x < -p.r) p.x = width + p.r
      if (p.x > width + p.r) p.x = -p.r

      if (p.y < -p.r) p.y = height + p.r
      if (p.y > height + p.r) p.y = -p.r
    }

    if (!reduceMotion) animationId = requestAnimationFrame(draw)
  }

  // Größenänderung leert das Canvas – im statischen Modus daher neu zeichnen
  const onResize = () => {
    resize()
    if (reduceMotion) draw()
  }

  window.addEventListener('resize', onResize)
  draw()

  stop = () => {
    cancelAnimationFrame(animationId)
    window.removeEventListener('resize', onResize)
  }
})

onUnmounted(() => stop?.())
</script>

<style scoped lang="scss">
canvas {
  position: fixed;
  inset: 0;
  z-index: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
</style>
