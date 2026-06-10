<template>
  <canvas ref="canvas"></canvas>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const canvas = ref<HTMLCanvasElement | null>(null)

let animationId = 0

onMounted(() => {
  const c = canvas.value

  if (!c) return

  const ctx = c.getContext('2d')

  if (!ctx) return

  const resize = () => {
    c.width = window.innerWidth
    c.height = window.innerHeight
  }

  resize()
  window.addEventListener('resize', resize)

  const particles = Array.from({ length: 80 }, () => ({
    x: Math.random() * c.width,
    y: Math.random() * c.height,
    r: Math.random() * 200 + 100,
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.3,
  }))

  const draw = () => {
    ctx.clearRect(0, 0, c.width, c.height)

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

      if (p.x < -p.r) p.x = c.width + p.r
      if (p.x > c.width + p.r) p.x = -p.r

      if (p.y < -p.r) p.y = c.height + p.r
      if (p.y > c.height + p.r) p.y = -p.r
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
  width: 100vw;
  height: 100vh;

  z-index: 0;
  pointer-events: none;
}
</style>
