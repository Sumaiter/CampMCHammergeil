<template>
  <canvas ref="canvas"></canvas>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const canvas = ref<HTMLCanvasElement | null>(null)

let animationId = 0
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  const c = canvas.value
  if (!c) return

  const ctx = c.getContext('2d')
  if (!ctx) return

  const resize = () => {
    const dpr = window.devicePixelRatio || 1

    c.width = window.innerWidth * dpr
    c.height = window.innerHeight * dpr

    c.style.width = '100%'
    c.style.height = '100%'

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  resize()

  window.addEventListener('resize', resize)

  const particles = Array.from({ length: 70 }, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    r: Math.random() * 180 + 80,
    vx: (Math.random() - 0.5) * 0.25,
    vy: (Math.random() - 0.5) * 0.25,
  }))

  const draw = () => {
    if (!ctx || !c) return

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)

    for (const p of particles) {
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r)

      grad.addColorStop(0, 'rgba(255,255,255,0.08)')
      grad.addColorStop(1, 'rgba(255,255,255,0)')

      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
      ctx.fill()

      p.x += p.vx
      p.y += p.vy

      if (p.x < -p.r) p.x = window.innerWidth + p.r
      if (p.x > window.innerWidth + p.r) p.x = -p.r

      if (p.y < -p.r) p.y = window.innerHeight + p.r
      if (p.y > window.innerHeight + p.r) p.y = -p.r
    }

    animationId = requestAnimationFrame(draw)
  }

  draw()

  onUnmounted(() => {
    cancelAnimationFrame(animationId)
    window.removeEventListener('resize', resize)
  })
})
</script>

<style scoped>
canvas {
  position: fixed;
  inset: 0;

  width: 100%;
  height: 100%;

  z-index: 0;
  pointer-events: none;
}
</style>
