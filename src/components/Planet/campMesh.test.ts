import { describe, expect, it } from 'vitest'
import { buildCampMesh, CAMP_LATITUDE, FLOATS_PER_VERTEX } from './campMesh'

const RAD = Math.PI / 180
const CAMP_DIR = [0, Math.sin(CAMP_LATITUDE * RAD), Math.cos(CAMP_LATITUDE * RAD)]

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

describe('buildCampMesh', () => {
  const mesh = buildCampMesh()
  const all = vertices(mesh)

  it('besteht aus ganzen Dreiecken', () => {
    expect(FLOATS_PER_VERTEX).toBe(9)
    expect(mesh.length).toBeGreaterThan(0)
    expect(mesh.length % (3 * FLOATS_PER_VERTEX)).toBe(0)
  })

  it('liegt klein auf der Oberfläche am Camp-Platz', () => {
    for (const { p } of all) {
      expect(length(p)).toBeGreaterThanOrEqual(0.98)
      expect(length(p)).toBeLessThanOrEqual(1.1)
      const angle = Math.acos(Math.min(1, dot(p, CAMP_DIR) / length(p))) / RAD
      expect(angle).toBeLessThan(10)
    }
  })

  it('hat normierte Normalen', () => {
    for (const { n } of all) expect(length(n)).toBeCloseTo(1, 3)
  })

  it('hat rote, gelbe, blaue Zelte mit dunklem Eingang und einen weißen Pavillon', () => {
    const colors = new Set(all.map(({ c }) => c.map((x) => x.toFixed(2)).join(',')))
    expect([...colors].sort()).toEqual(
      [
        '0.85,0.15,0.12',
        '0.95,0.80,0.15',
        '0.15,0.35,0.85',
        '0.95,0.95,0.92',
        '0.08,0.06,0.05',
      ].sort(),
    )
  })
})
