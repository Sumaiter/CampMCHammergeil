<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { createPlanetRenderer, EXTENT } from './planetRenderer'

// Höhere Pixeldichte bringt bei Flammen kaum etwas, kostet aber viel Leistung
const MAX_PIXEL_RATIO = 1.5
// Zeit regelmäßig zurücksetzen, damit das Rauschen nicht an Genauigkeit verliert
const TIME_WRAP_SECONDS = 1000

// Canvas ist größer als der Planet und zentriert, damit die Flammen über den Rand ragen
const canvasStyle = {
  width: `${EXTENT * 100}%`,
  height: `${EXTENT * 100}%`,
  left: `${-(EXTENT - 1) * 50}%`,
  top: `${-(EXTENT - 1) * 50}%`,
}

const canvas = ref<HTMLCanvasElement | null>(null)
const supported = ref(true)

let stop: (() => void) | undefined

onMounted(() => {
  const c = canvas.value
  const renderer = c && createPlanetRenderer(c)
  if (!c || !renderer) {
    supported.value = false // Fallback: CSS-Farbverlauf des Planeten bleibt sichtbar
    return
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const start = performance.now()
  let frame = 0
  let visible = true

  const draw = () => {
    renderer.render(((performance.now() - start) / 1000) % TIME_WRAP_SECONDS)
    if (visible && !reduceMotion) frame = requestAnimationFrame(draw)
  }

  const restart = () => {
    cancelAnimationFrame(frame)
    draw()
  }

  const resizeObserver = new ResizeObserver(([entry]) => {
    if (!entry) return
    const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO)
    renderer.resize(Math.round(entry.contentRect.width * pixelRatio))
    restart()
  })

  // Animation pausieren, solange der Planet aus dem Bild gescrollt ist
  const intersectionObserver = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? true
    if (visible) restart()
    else cancelAnimationFrame(frame)
  })

  const onContextLost = (event: Event) => {
    event.preventDefault()
    cancelAnimationFrame(frame)
    supported.value = false
  }

  resizeObserver.observe(c)
  intersectionObserver.observe(c)
  c.addEventListener('webglcontextlost', onContextLost)

  stop = () => {
    cancelAnimationFrame(frame)
    resizeObserver.disconnect()
    intersectionObserver.disconnect()
    c.removeEventListener('webglcontextlost', onContextLost)
    renderer.dispose()
  }
})

onUnmounted(() => stop?.())
</script>

<template>
  <canvas
    v-show="supported"
    ref="canvas"
    class="planet-canvas"
    :style="canvasStyle"
    aria-hidden="true"
  ></canvas>
</template>

<style scoped lang="scss">
.planet-canvas {
  position: absolute;
  z-index: 0;
  pointer-events: none;
}
</style>
