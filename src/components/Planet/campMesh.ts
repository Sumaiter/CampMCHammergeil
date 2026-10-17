// Festival-Camp auf dem Planeten: Firstzelt, Tunnelzelt, Kuppelzelt mit Vorzelt, Pavillon mit Fahne und
// Bierkisten – und ein Stück weiter eine kleine Bühne. Alles sind Dreiecke aus dem Code, keine Bilder
// oder Modelldateien, damit die Seite schnell lädt. Formen und Farben sind bewusst generisch (keine Logos).
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
const PORCH: Color = [0.3, 0.3, 0.34] // Vorzelt (Apsis)
const ORANGE: Color = [1.0, 0.55, 0.1] // Fahne, Lichtleiste
const CRATE_YELLOW: Color = [0.9, 0.72, 0.1]
const CRATE_GREEN: Color = [0.12, 0.5, 0.22]
const STEEL: Color = [0.45, 0.45, 0.5] // Fahnenmast, Traversen
const STAGE_FLOOR: Color = [0.22, 0.22, 0.25]
const BLACK: Color = [0.07, 0.07, 0.08] // Boxen, Rückwand, Dach
const SCREEN: Color = [0.85, 0.3, 1.0] // LED-Wand

// Objekte beginnen knapp unter der Oberfläche, damit nichts schwebt
const GROUND = -0.005

const DOME_RADIUS = 0.045
const DOME_HEIGHT = 0.042
const DOME_SEGMENTS = 8
const DOME_RINGS = 3
const PORCH_RADIUS = 0.028
const PORCH_HEIGHT = 0.024
const PORCH_RINGS = 2
const DOOR_HALF_ANGLE = (24 * Math.PI) / 180
const DOOR_HEIGHT_ANGLE = (50 * Math.PI) / 180

const RIDGE_HALF_WIDTH = 0.038
const RIDGE_HALF_LENGTH = 0.05
const RIDGE_HEIGHT = 0.045

const TUNNEL_RADIUS = 0.032
const TUNNEL_HALF_LENGTH = 0.04
const TUNNEL_NOSE = 0.025 // flach auslaufende Enden
const TUNNEL_SEGMENTS = 6

const POLE_HALF_WIDTH = 0.003
const PAVILION_HEIGHT = 0.055
const ROOF_HALF_SIZE = 0.042
const ROOF_TOP = 0.078

const FLAG_HEIGHT = 0.1
const FLAG_WIDTH = 0.03
const FLAG_DROP = 0.02
const FLAG_SWAY = 0.016 // die Fahne weht schräg nach Süden, so fängt sie Licht von oben

const CRATE_HALF_X = 0.011
const CRATE_HALF_Y = 0.008
const CRATE_HEIGHT = 0.009

// Bühne: Lage relativ zum Camp (Osten, Norden) – ca. 17° östlich, etwas südlich – und Blickrichtung
const STAGE_OFFSET: [number, number] = [0.3, -0.06]
const STAGE_HEADING = (-15 * Math.PI) / 180 // Front zeigt leicht nach Südwesten: zum Betrachter und zum Camp
const STAGE_HALF_WIDTH = 0.055
const STAGE_HALF_DEPTH = 0.028
const STAGE_DECK_HEIGHT = 0.012
const STAGE_ROOF_HEIGHT = 0.075
const STAGE_ROOF_THICKNESS = 0.005
const STAGE_ROOF_FRONT = 0.012 // Dach nur über dem hinteren Teil, damit die LED-Wand von oben sichtbar bleibt
const TRUSS_HALF_DEPTH = 0.004
const STAGE_WALL_THICKNESS = 0.007
const PA_HALF_SIZE = 0.009
const PA_HEIGHT = 0.05

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

// Kugelnormale an einer Stelle nahe dem Camp (lokale Koordinaten Osten, Norden)
const directionAt = (x: number, y: number): Vec3 =>
  normalize(add(camp.up, add(scale(camp.east, x), scale(camp.north, y))))

// Richtung zur Bühne in Objektkoordinaten – der Shader hält dort die Flammen fern
export const STAGE_DIR: Vec3 = directionAt(...STAGE_OFFSET)

// Ein Gegenstand des Camps: lokale Koordinaten (Osten, Norden, Höhe) → Objektkoordinaten.
// heading dreht den Gegenstand um seine Hochachse (Bogenmaß, gegen den Uhrzeigersinn von oben).
function placeAt(x: number, y: number, heading = 0) {
  const frame = frameAt(directionAt(x, y))
  const c = Math.cos(heading)
  const s = Math.sin(heading)
  const toWorld = ([e, n, h]: Vec3): Vec3 =>
    add(
      add(scale(frame.east, c * e - s * n), scale(frame.north, s * e + c * n)),
      scale(frame.up, h),
    )
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

  // Achsparalleler Quader ohne Boden (x0 < x1, y0 < y1, z0 < z1)
  box(
    at: Placement,
    color: Color,
    [x0, x1]: [number, number],
    [y0, y1]: [number, number],
    [z0, z1]: [number, number],
  ) {
    this.quad(at, color, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]) // oben
    this.quad(at, color, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]) // Süd
    this.quad(at, color, [x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1]) // Nord
    this.quad(at, color, [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]) // Ost
    this.quad(at, color, [x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]) // West
  }

  // Senkrechte Stange
  pole(at: Placement, color: Color, x: number, y: number, height: number) {
    const w = POLE_HALF_WIDTH
    this.box(at, color, [x - w, x + w], [y - w, y + w], [GROUND, height])
  }

  build() {
    return new Float32Array(this.data)
  }
}

// Kuppel: halbes Ellipsoid um (cx, cy), optional mit dunklem Eingang Richtung Süden
function dome(
  mesh: MeshBuilder,
  at: Placement,
  color: Color,
  [cx, cy]: [number, number],
  radius: number,
  height: number,
  rings: number,
  withDoor: boolean,
) {
  // phi = Höhenwinkel (0 = Boden, 90° = Spitze), theta = Richtung um das Zelt, lift = Abstand nach außen
  const surface = (phi: number, theta: number, lift = 1) => {
    const c = Math.cos(phi)
    const s = Math.sin(phi)
    const point: Vec3 = [
      cx + lift * radius * c * Math.cos(theta),
      cy + lift * radius * c * Math.sin(theta),
      GROUND + lift * height * s,
    ]
    const normal: Vec3 = [
      (c * Math.cos(theta)) / radius,
      (c * Math.sin(theta)) / radius,
      s / height,
    ]
    return { point, normal }
  }
  const vertex = (ring: number, segment: number) =>
    surface((ring / rings) * (Math.PI / 2), (segment / DOME_SEGMENTS) * 2 * Math.PI)

  for (let ring = 0; ring < rings; ring++) {
    for (let segment = 0; segment < DOME_SEGMENTS; segment++) {
      const a = vertex(ring, segment)
      const b = vertex(ring, segment + 1)
      const c = vertex(ring + 1, segment + 1)
      const d = vertex(ring + 1, segment)
      mesh.triangle(at, color, [a.point, b.point, c.point], [a.normal, b.normal, c.normal])
      if (ring < rings - 1) {
        mesh.triangle(at, color, [a.point, c.point, d.point], [a.normal, c.normal, d.normal])
      }
    }
  }

  if (!withDoor) return
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

// Kuppelzelt mit Vorzelt (Apsis) nach Süden, Eingang im Vorzelt
function domeTent(mesh: MeshBuilder, at: Placement, color: Color) {
  dome(mesh, at, color, [0, 0], DOME_RADIUS, DOME_HEIGHT, DOME_RINGS, false)
  dome(mesh, at, PORCH, [0, -DOME_RADIUS * 0.9], PORCH_RADIUS, PORCH_HEIGHT, PORCH_RINGS, true)
}

// Firstzelt: zwei schräge Dachflächen, Giebel vorne und hinten, Eingang im Südgiebel
function ridgeTent(mesh: MeshBuilder, at: Placement, color: Color) {
  const w = RIDGE_HALF_WIDTH
  const l = RIDGE_HALF_LENGTH
  const h = RIDGE_HEIGHT
  mesh.quad(at, color, [-w, -l, GROUND], [0, -l, h], [0, l, h], [-w, l, GROUND]) // West
  mesh.quad(at, color, [w, l, GROUND], [0, l, h], [0, -l, h], [w, -l, GROUND]) // Ost
  mesh.flat(at, color, [-w, -l, GROUND], [w, -l, GROUND], [0, -l, h]) // Südgiebel
  mesh.flat(at, color, [w, l, GROUND], [-w, l, GROUND], [0, l, h]) // Nordgiebel
  const d = -l - 0.002
  mesh.flat(at, DOOR, [-w * 0.4, d, GROUND], [w * 0.4, d, GROUND], [0, d, h * 0.7])
}

// Tunnelzelt: halber Zylinder entlang der Ost-West-Achse, Enden laufen flach aus, Eingang an der Südseite
function tunnelTent(mesh: MeshBuilder, at: Placement, color: Color) {
  const r = TUNNEL_RADIUS
  const l = TUNNEL_HALF_LENGTH
  // theta: 0 = Nordseite am Boden, 90° = First, 180° = Südseite am Boden
  const arc = (x: number, theta: number, lift = 1): Vec3 => [
    x,
    lift * r * Math.cos(theta),
    GROUND + lift * r * Math.sin(theta),
  ]
  const arcNormal = (theta: number): Vec3 => [0, Math.cos(theta), Math.sin(theta)]
  const noseEast: Vec3 = [l + TUNNEL_NOSE, 0, GROUND]
  const noseWest: Vec3 = [-l - TUNNEL_NOSE, 0, GROUND]

  for (let i = 0; i < TUNNEL_SEGMENTS; i++) {
    const t0 = (i / TUNNEL_SEGMENTS) * Math.PI
    const t1 = ((i + 1) / TUNNEL_SEGMENTS) * Math.PI
    const n0 = arcNormal(t0)
    const n1 = arcNormal(t1)
    mesh.triangle(at, color, [arc(-l, t0), arc(l, t0), arc(l, t1)], [n0, n0, n1])
    mesh.triangle(at, color, [arc(-l, t0), arc(l, t1), arc(-l, t1)], [n0, n1, n1])
    mesh.flat(at, color, noseEast, arc(l, t0), arc(l, t1))
    mesh.flat(at, color, noseWest, arc(-l, t1), arc(-l, t0))
  }

  // Eingang: dunkles Rechteck knapp vor der Südwand
  const lift = 1.08
  const bottom = (165 * Math.PI) / 180
  const top = (128 * Math.PI) / 180
  const half = 0.011
  mesh.quad(
    at,
    DOOR,
    arc(-half, bottom, lift),
    arc(half, bottom, lift),
    arc(half, top, lift),
    arc(-half, top, lift),
  )
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
    mesh.pole(at, color, x, y, PAVILION_HEIGHT)
  }

  const eaves: Vec3[] = [
    [-s, -s, PAVILION_HEIGHT],
    [s, -s, PAVILION_HEIGHT],
    [s, s, PAVILION_HEIGHT],
    [-s, s, PAVILION_HEIGHT],
  ]
  const top: Vec3 = [0, 0, ROOF_TOP]
  for (let i = 0; i < 4; i++) mesh.flat(at, color, eaves[i]!, eaves[(i + 1) % 4]!, top)
  mesh.quad(at, color, eaves[3]!, eaves[2]!, eaves[1]!, eaves[0]!)
}

// Fahnenmast mit Fahne, die nach Osten weht und schräg nach Süden hängt (Oberseite zum Licht)
function flag(mesh: MeshBuilder, at: Placement, color: Color) {
  mesh.pole(at, STEEL, 0, 0, FLAG_HEIGHT)
  const top = FLAG_HEIGHT - 0.002
  mesh.quad(
    at,
    color,
    [0, 0, top],
    [FLAG_WIDTH, 0, top],
    [FLAG_WIDTH, -FLAG_SWAY, top - FLAG_DROP],
    [0, -FLAG_SWAY, top - FLAG_DROP],
  )
}

// Zwei mal zwei gestapelte Getränkekisten
function crates(mesh: MeshBuilder, at: Placement) {
  for (let level = 0; level < 2; level++) {
    for (let column = 0; column < 2; column++) {
      const x = (column - 0.5) * 2 * CRATE_HALF_X
      const z0 = GROUND + level * CRATE_HEIGHT
      const color = (level + column) % 2 === 0 ? CRATE_YELLOW : CRATE_GREEN
      mesh.box(
        at,
        color,
        [x - CRATE_HALF_X, x + CRATE_HALF_X],
        [-CRATE_HALF_Y, CRATE_HALF_Y],
        [z0, z0 + CRATE_HEIGHT],
      )
    }
  }
}

// Kleine Festivalbühne: Podest, Rückwand mit LED-Wand, Dach hinten, Lichttraverse vorn, PA-Türme. Front = Süden.
function stage(mesh: MeshBuilder, at: Placement) {
  const w = STAGE_HALF_WIDTH
  const d = STAGE_HALF_DEPTH
  const roofBottom = STAGE_ROOF_HEIGHT
  const roofTop = roofBottom + STAGE_ROOF_THICKNESS
  const trussY = -d - 0.002

  mesh.box(at, STAGE_FLOOR, [-w, w], [-d, d], [GROUND, STAGE_DECK_HEIGHT])
  mesh.box(at, BLACK, [-w, w], [d - STAGE_WALL_THICKNESS, d], [STAGE_DECK_HEIGHT, roofBottom])
  // LED-Wand: helles Rechteck knapp vor der Rückwand
  const screenY = d - STAGE_WALL_THICKNESS - 0.001
  mesh.quad(
    at,
    SCREEN,
    [-w * 0.8, screenY, STAGE_DECK_HEIGHT + 0.008],
    [w * 0.8, screenY, STAGE_DECK_HEIGHT + 0.008],
    [w * 0.8, screenY, roofBottom - 0.008],
    [-w * 0.8, screenY, roofBottom - 0.008],
  )
  // Dach über dem hinteren Teil, vorn eine Traverse mit Lichtleiste obenauf
  mesh.box(at, BLACK, [-w - 0.006, w + 0.006], [STAGE_ROOF_FRONT, d + 0.004], [roofBottom, roofTop])
  mesh.box(
    at,
    STEEL,
    [-w - 0.006, w + 0.006],
    [trussY - TRUSS_HALF_DEPTH, trussY + TRUSS_HALF_DEPTH],
    [roofBottom, roofTop],
  )
  mesh.quad(
    at,
    ORANGE,
    [-w, trussY - TRUSS_HALF_DEPTH, roofTop + 0.0005],
    [w, trussY - TRUSS_HALF_DEPTH, roofTop + 0.0005],
    [w, trussY + TRUSS_HALF_DEPTH, roofTop + 0.0005],
    [-w, trussY + TRUSS_HALF_DEPTH, roofTop + 0.0005],
  )
  for (const [x, y] of [
    [-w, trussY],
    [w, trussY],
    [w, d - STAGE_WALL_THICKNESS / 2],
    [-w, d - STAGE_WALL_THICKNESS / 2],
  ] as const) {
    mesh.pole(at, STEEL, x, y, roofBottom)
  }
  // PA-Türme links und rechts vor der Bühne
  for (const x of [-w - 0.014, w + 0.014]) {
    mesh.box(
      at,
      BLACK,
      [x - PA_HALF_SIZE, x + PA_HALF_SIZE],
      [-d - PA_HALF_SIZE, -d + PA_HALF_SIZE],
      [GROUND, PA_HEIGHT],
    )
  }
}

export function buildCampMesh(): Float32Array {
  const mesh = new MeshBuilder()
  const deg = Math.PI / 180
  pavilion(mesh, placeAt(0, 0), WHITE)
  ridgeTent(mesh, placeAt(-0.095, 0.03, 25 * deg), RED)
  tunnelTent(mesh, placeAt(0.085, 0.045, -15 * deg), YELLOW)
  domeTent(mesh, placeAt(0, -0.095), BLUE)
  flag(mesh, placeAt(0.06, -0.04), ORANGE)
  crates(mesh, placeAt(-0.06, -0.045, 10 * deg))
  stage(mesh, placeAt(...STAGE_OFFSET, STAGE_HEADING))
  return mesh.build()
}
