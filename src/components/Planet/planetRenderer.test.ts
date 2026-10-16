import { describe, expect, it } from 'vitest'
import { bakeStrip, rotationAngles } from './planetRenderer'

// Abstand zweier Winkel auf dem Kreis
const angleStep = (a: number, b: number) => {
  const d = Math.abs(a - b) % (2 * Math.PI)
  return Math.min(d, 2 * Math.PI - d)
}

describe('rotationAngles', () => {
  it('springt weder beim Planeten noch bei den Wolken', () => {
    let previous = rotationAngles(0)
    for (let t = 0.01; t < 400; t += 0.01) {
      const current = rotationAngles(t)
      expect(angleStep(current.planet, previous.planet)).toBeLessThan(0.01)
      expect(angleStep(current.clouds, previous.clouds)).toBeLessThan(0.01)
      previous = current
    }
  })

  it('Wolken drehen langsamer als der Planet', () => {
    expect(rotationAngles(10).clouds).toBeCloseTo(rotationAngles(10).planet * 0.8, 6)
  })
})

describe('bakeStrip', () => {
  it('teilt die Textur in lückenlose Streifen', () => {
    const strips = []
    for (let done = 0; done < 512; ) {
      const strip = bakeStrip(done, 512)
      strips.push(strip)
      done = strip.y + strip.height
    }
    expect(strips.length).toBe(8)
    expect(strips[0]).toEqual({ y: 0, height: 64 })
    expect(strips.at(-1)).toEqual({ y: 448, height: 64 })
  })

  it('kürzt den letzten Streifen', () => {
    expect(bakeStrip(250, 256)).toEqual({ y: 250, height: 6 })
  })
})
