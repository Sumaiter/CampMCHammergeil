// Kleines Festival-Camp auf dem Planeten: drei Kuppelzelte und ein Pavillon als Dreiecksliste.
// Koordinaten wie im Shader: Planetenradius 1, Objektkoordinaten (vor der Drehung), y = Drehachse.

// Breite des Camps; Länge 0 (zeigt beim Drehwinkel 0 nach vorne). Muss zu CAMP_DIR im Shader passen.
export const CAMP_LATITUDE = 35

// Pro Ecke: Position (3), Normale (3), Farbe (3)
export const FLOATS_PER_VERTEX = 9

type Vec3 = [number, number, number]
type Color = Vec3

const RED: Color = [0.85, 0.15, 0.12]
const YELLOW: Color = [0.95, 0.8, 0.15]
const BLUE: Color = [0.15, 0.35, 0.85]
const WHITE: Color = [0.95, 0.95, 0.92]
const DOOR: Color = [0.08, 0.06, 0.05]

// Zelte beginnen knapp unter der Oberfläche, damit nichts schwebt
const GROUND = -0.005
const TENT_RADIUS = 0.05
const TENT_HEIGHT = 0.045
const TENT_SEGMENTS = 8
const TENT_RINGS = 3
const DOOR_HALF_ANGLE = (24 * Math.PI) / 180
const DOOR_HEIGHT_ANGLE = (50 * Math.PI) / 180
const POLE_HALF_WIDTH = 0.003
const POLE_HEIGHT = 0.055
const ROOF_HALF_SIZE = 0.042
const ROOF_TOP = 0.078

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s]
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const normalize = (a: Vec3): Vec3 => scale(a, 1 / Math.hypot(...a))

// Tangentensystem an einer Stelle der Kugel: east, north, up (= Kugelnormale)
function frameAt(up: Vec3) {
  const east = normalize(cross([0, 1, 0], up))
  return { east, north: cross(up, east), up }
}

const lat = (CAMP_LATITUDE * Math.PI) / 180
const camp = frameAt([0, Math.sin(lat), Math.cos(lat)])

// Ein Gegenstand des Camps: lokale Koordinaten (Osten, Norden, Höhe) → Objektkoordinaten
function placeAt(x: number, y: number) {
  const frame = frameAt(normalize(add(camp.up, add(scale(camp.east, x), scale(camp.north, y)))))
  const toWorld = ([e, n, h]: Vec3): Vec3 =>
    add(add(scale(frame.east, e), scale(frame.north, n)), scale(frame.up, h))
  return {
    point: (local: Vec3) => add(frame.up, toWorld(local)),
    normal: (local: Vec3) => normalize(toWorld(local)),
  }
}

type Placement = ReturnType<typeof placeAt>

class MeshBuilder {
  private data: number[] = []

  // Dreieck mit einer Normalen pro Ecke (lokale Koordinaten)
  triangle(at: Placement, color: Color, corners: [Vec3, Vec3, Vec3], normals: [Vec3, Vec3, Vec3]) {
    corners.forEach((corner, i) => {
      this.data.push(...at.point(corner), ...at.normal(normals[i]!), ...color)
    })
  }

  // Ebenes Dreieck: Normale aus den Ecken
  flat(at: Placement, color: Color, a: Vec3, b: Vec3, c: Vec3) {
    const n = cross(sub(b, a), sub(c, a))
    this.triangle(at, color, [a, b, c], [n, n, n])
  }

  quad(at: Placement, color: Color, a: Vec3, b: Vec3, c: Vec3, d: Vec3) {
    this.flat(at, color, a, b, c)
    this.flat(at, color, a, c, d)
  }

  build() {
    return new Float32Array(this.data)
  }
}

// Kuppelzelt: halbes Ellipsoid
function domeTent(mesh: MeshBuilder, at: Placement, color: Color) {
  // phi = Höhenwinkel (0 = Boden, 90° = Spitze), theta = Richtung um das Zelt, lift = Abstand nach außen
  const surface = (phi: number, theta: number, lift = 1) => {
    const c = Math.cos(phi)
    const s = Math.sin(phi)
    const point: Vec3 = [
      lift * TENT_RADIUS * c * Math.cos(theta),
      lift * TENT_RADIUS * c * Math.sin(theta),
      GROUND + lift * TENT_HEIGHT * s,
    ]
    const normal: Vec3 = [
      (c * Math.cos(theta)) / TENT_RADIUS,
      (c * Math.sin(theta)) / TENT_RADIUS,
      s / TENT_HEIGHT,
    ]
    return { point, normal }
  }
  const vertex = (ring: number, segment: number) =>
    surface((ring / TENT_RINGS) * (Math.PI / 2), (segment / TENT_SEGMENTS) * 2 * Math.PI)

  for (let ring = 0; ring < TENT_RINGS; ring++) {
    for (let segment = 0; segment < TENT_SEGMENTS; segment++) {
      const a = vertex(ring, segment)
      const b = vertex(ring, segment + 1)
      const c = vertex(ring + 1, segment + 1)
      const d = vertex(ring + 1, segment)
      mesh.triangle(at, color, [a.point, b.point, c.point], [a.normal, b.normal, c.normal])
      if (ring < TENT_RINGS - 1) {
        mesh.triangle(at, color, [a.point, c.point, d.point], [a.normal, c.normal, d.normal])
      }
    }
  }

  // Eingang Richtung Süden (zum Betrachter, wenn das Camp vorne steht), knapp vor der Zeltwand
  const south = -Math.PI / 2
  const left = surface(0, south - DOOR_HALF_ANGLE, 1.04)
  const right = surface(0, south + DOOR_HALF_ANGLE, 1.04)
  const top = surface(DOOR_HEIGHT_ANGLE, south, 1.04)
  mesh.triangle(
    at,
    DOOR,
    [left.point, right.point, top.point],
    [left.normal, right.normal, top.normal],
  )
}

// Senkrechter Quader ohne Boden (Pavillon-Stange)
function pole(mesh: MeshBuilder, at: Placement, color: Color, x: number, y: number) {
  const w = POLE_HALF_WIDTH
  const corner = (dx: number, dy: number, h: number): Vec3 => [x + dx * w, y + dy * w, h]
  const sides: [number, number, number, number][] = [
    [-1, -1, 1, -1],
    [1, -1, 1, 1],
    [1, 1, -1, 1],
    [-1, 1, -1, -1],
  ]
  for (const [ax, ay, bx, by] of sides) {
    mesh.quad(
      at,
      color,
      corner(ax, ay, GROUND),
      corner(bx, by, GROUND),
      corner(bx, by, POLE_HEIGHT),
      corner(ax, ay, POLE_HEIGHT),
    )
  }
}

// Pavillon: vier Stangen + flaches Spitzdach mit Unterseite
function pavilion(mesh: MeshBuilder, at: Placement, color: Color) {
  const s = ROOF_HALF_SIZE
  const inset = s - POLE_HALF_WIDTH * 2
  for (const [x, y] of [
    [-inset, -inset],
    [inset, -inset],
    [inset, inset],
    [-inset, inset],
  ] as const) {
    pole(mesh, at, color, x, y)
  }

  const eaves: Vec3[] = [
    [-s, -s, POLE_HEIGHT],
    [s, -s, POLE_HEIGHT],
    [s, s, POLE_HEIGHT],
    [-s, s, POLE_HEIGHT],
  ]
  const top: Vec3 = [0, 0, ROOF_TOP]
  for (let i = 0; i < 4; i++) mesh.flat(at, color, eaves[i]!, eaves[(i + 1) % 4]!, top)
  mesh.quad(at, color, eaves[3]!, eaves[2]!, eaves[1]!, eaves[0]!)
}

export function buildCampMesh(): Float32Array {
  const mesh = new MeshBuilder()
  pavilion(mesh, placeAt(0, 0), WHITE)
  domeTent(mesh, placeAt(-0.092, 0.036), RED)
  domeTent(mesh, placeAt(0.09, 0.042), YELLOW)
  domeTent(mesh, placeAt(0.014, -0.096), BLUE)
  return mesh.build()
}
