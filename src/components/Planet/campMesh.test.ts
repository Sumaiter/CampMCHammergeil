import { describe, expect, it } from 'vitest'
import { buildCampMesh, CAMP_LATITUDE, FLOATS_PER_VERTEX, STAGE_DIR } from './campMesh'

const RAD = Math.PI / 180
const CAMP_DIR = [0, Math.sin(CAMP_LATITUDE * RAD), Math.cos(CAMP_LATITUDE * RAD)]

// Mehr Dreiecke braucht die Szene nicht – hält Code und Grafikspeicher klein
const MAX_TRIANGLES = 600

function vertices(mesh: Float32Array) {
  const result = []
  for (let i = 0; i < mesh.length; i += FLOATS_PER_VERTEX) {
    const v = Array.from(mesh.subarray(i, i + FLOATS_PER_VERTEX))
    result.push({ p: v.slice(0, 3), n: v.slice(3, 6), c: v.slice(6, 9) })
  }
  return result
}

const length = (v: number[]) => Math.hypot(...v)
const dot = (a: number[], b: number[]) => a.reduce((sum, x, i) => sum + x * b[i]!, 0)
const angleBetween = (a: number[], b: number[]) =>
  Math.acos(Math.min(1, dot(a, b) / (length(a) * length(b)))) / RAD

describe('buildCampMesh', () => {
  const mesh = buildCampMesh()
  const all = vertices(mesh)

  it('besteht aus ganzen Dreiecken und bleibt klein', () => {
    expect(FLOATS_PER_VERTEX).toBe(9)
    expect(mesh.length).toBeGreaterThan(0)
    expect(mesh.length % (3 * FLOATS_PER_VERTEX)).toBe(0)
    expect(mesh.length / (3 * FLOATS_PER_VERTEX)).toBeLessThanOrEqual(MAX_TRIANGLES)
  })

  it('liegt auf der Oberfläche, beim Camp oder bei der Bühne', () => {
    for (const { p } of all) {
      expect(length(p)).toBeGreaterThanOrEqual(0.98)
      expect(length(p)).toBeLessThanOrEqual(1.12)
      const nearCamp = angleBetween(p, CAMP_DIR) < 11
      const nearStage = angleBetween(p, STAGE_DIR) < 6
      expect(nearCamp || nearStage).toBe(true)
    }
  })

  it('Bühne steht ein Stück abseits vom Camp', () => {
    expect(length(STAGE_DIR)).toBeCloseTo(1, 6)
    const distance = angleBetween(STAGE_DIR, CAMP_DIR)
    expect(distance).toBeGreaterThan(15)
    expect(distance).toBeLessThan(20)
    expect(all.some(({ p }) => angleBetween(p, STAGE_DIR) < 3)).toBe(true)
  })

  it('hat endliche, normierte Normalen', () => {
    for (const { n } of all) {
      expect(n.every(Number.isFinite)).toBe(true)
      expect(length(n)).toBeCloseTo(1, 3)
    }
  })

  it('hat rote, gelbe, blaue Zelte mit dunklen Eingängen, weißen Pavillon, Fahne und LED-Wand', () => {
    const colors = new Set(all.map(({ c }) => c.map((x) => x.toFixed(2)).join(',')))
    for (const expected of [
      '0.85,0.15,0.12', // rotes Firstzelt
      '0.95,0.80,0.15', // gelbes Tunnelzelt
      '0.15,0.35,0.85', // blaues Kuppelzelt
      '0.95,0.95,0.92', // Pavillon
      '0.08,0.06,0.05', // Eingänge
      '1.00,0.55,0.10', // Fahne
      '0.85,0.30,1.00', // LED-Wand der Bühne
    ]) {
      expect(colors).toContain(expected)
    }
  })
})
