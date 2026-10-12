// WebGL-Renderer für den Planeten: Kraterlandschaft + animierte grüne Flammen.
//
// Die Oberfläche ist teuer (Krater, Licht, Schatten) und ändert sich nicht – sie wird bei
// jeder Größenänderung einmal in eine Textur gerendert. Pro Frame werden nur die Flammen
// berechnet und mit dieser Textur kombiniert.

// Canvas ist EXTENT-mal so breit wie der Planet, damit die Flammen Platz haben.
export const EXTENT = 1.9

const VERTEX_SHADER = `
attribute vec2 aPos;
varying vec2 vUv;

void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`

const COMMON = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

varying vec2 vUv;
uniform float uExtent;

float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

vec3 hash33(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yxx) * p3.zyx);
}

float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(
      mix(hash13(i), hash13(i + vec3(1.0, 0.0, 0.0)), u.x),
      mix(hash13(i + vec3(0.0, 1.0, 0.0)), hash13(i + vec3(1.0, 1.0, 0.0)), u.x),
      u.y
    ),
    mix(
      mix(hash13(i + vec3(0.0, 0.0, 1.0)), hash13(i + vec3(1.0, 0.0, 1.0)), u.x),
      mix(hash13(i + vec3(0.0, 1.0, 1.0)), hash13(i + vec3(1.0, 1.0, 1.0)), u.x),
      u.y
    ),
    u.z
  );
}

float fbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 5; i++) {
    value += amplitude * noise(p);
    p = p * 2.02 + vec3(1.7, 9.2, 3.1);
    amplitude *= 0.5;
  }
  return value;
}

// Pixelposition in Planeten-Einheiten (Radius = 1, y zeigt nach oben)
vec2 planetCoord() {
  return (vUv * 2.0 - 1.0) * uExtent;
}
`

const SURFACE_SHADER = `
uniform float uPixel;

// Kraterlagen: x = Maßstab, y = Versatz, z = Dichte (Anteil der Zellen mit Krater)
const vec3 BIG_CRATERS = vec3(2.0, 0.0, 0.5);
const vec3 MID_CRATERS = vec3(4.6, 13.1, 1.0);
const vec3 SMALL_CRATERS = vec3(9.5, 41.7, 1.0);
const vec3 NO_CRATERS = vec3(0.0);

// Krater einer Zelle: xyz = Mittelpunkt, w = Radius (beides in Lagen-Koordinaten), w < 0 = keiner
vec4 craterAt(vec3 cellId, float density) {
  vec3 rnd = hash33(cellId);
  if (rnd.z > density) return vec4(-1.0);
  return vec4(cellId + 0.2 + 0.6 * hash33(cellId + 19.7), 0.22 + 0.28 * rnd.x);
}

// Sichtbarer Kreis eines Kraters auf der Oberfläche, Rand eingerechnet (Planeten-Koordinaten):
// xyz = Richtung zur Kreismitte, w = Radius (< 0, wenn der Krater die Oberfläche verfehlt)
vec4 craterFootprint(vec4 crater, vec3 layer) {
  vec3 center = (crater.xyz - layer.y) / layer.x;
  float reach = 1.15 * crater.w / layer.x;
  float offset = length(center) - 1.0;
  if (reach <= abs(offset)) return vec4(-1.0);
  return vec4(normalize(center), sqrt(reach * reach - offset * offset));
}

// Ob in einer Lage ein Krater mit Radius > minRadius den sichtbaren Kreis footprint berührt
bool touchesCrater(vec4 footprint, float minRadius, vec3 layer) {
  vec3 i = floor(footprint.xyz * layer.x + layer.y);
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      for (int z = -1; z <= 1; z++) {
        vec4 other = craterAt(i + vec3(float(x), float(y), float(z)), layer.z);
        if (other.w <= minRadius) continue;
        vec4 otherFootprint = craterFootprint(other, layer);
        if (otherFootprint.w < 0.0) continue;
        if (length(footprint.xyz - otherFootprint.xyz) < footprint.w + otherFootprint.w) return true;
      }
    }
  }
  return false;
}

// Eine Lage zufällig verteilter Krater (Schüssel + erhöhter Rand), nahtlos auf der Kugel.
// Krater, die einen größeren berühren würden – aus dieser Lage oder den gröberen Lagen
// coarse1/coarse2 –, entfallen, damit keine zwei Krater ineinander liegen.
float craterLayer(vec3 n, vec3 layer, vec3 coarse1, vec3 coarse2) {
  vec3 p = n * layer.x + layer.y;
  vec3 i = floor(p);
  float h = 0.0;
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      for (int z = -1; z <= 1; z++) {
        vec4 crater = craterAt(i + vec3(float(x), float(y), float(z)), layer.z);
        if (crater.w < 0.0) continue;
        float d = length(p - crater.xyz) / crater.w;
        if (d > 2.0) continue;
        vec4 footprint = craterFootprint(crater, layer);
        if (footprint.w > 0.0) {
          if (touchesCrater(footprint, crater.w, layer)) continue;
          if (coarse1.x > 0.0 && touchesCrater(footprint, 0.0, coarse1)) continue;
          if (coarse2.x > 0.0 && touchesCrater(footprint, 0.0, coarse2)) continue;
        }
        float bowl = d < 1.0 ? d * d - 1.0 : 0.0;
        float e = (d - 1.0) / 0.3;
        float rim = 0.22 * exp(-e * e);
        h += (bowl + rim) * crater.w;
      }
    }
  }
  return h;
}

float surfaceHeight(vec3 n) {
  float h = craterLayer(n, BIG_CRATERS, NO_CRATERS, NO_CRATERS) * 0.5;
  h += craterLayer(n, MID_CRATERS, BIG_CRATERS, NO_CRATERS) * 0.22;
  h += craterLayer(n, SMALL_CRATERS, BIG_CRATERS, MID_CRATERS) * 0.1;
  // felsige, raue Struktur
  h += (fbm(n * 6.0) - 0.5) * 0.09;
  h += (fbm(n * 18.0 + 3.0) - 0.5) * 0.05;
  h += (noise(n * 60.0) - 0.5) * 0.014;
  return h;
}

void main() {
  vec2 p = planetCoord();
  float r = length(p);
  float alpha = 1.0 - smoothstep(1.0 - uPixel, 1.0, r);
  if (alpha <= 0.0) {
    gl_FragColor = vec4(0.0);
    return;
  }

  vec2 pc = p / max(r, 1.0);
  float z = sqrt(max(1.0 - dot(pc, pc), 0.0));
  vec3 n = vec3(pc, z);

  // Oberflächen-Normale aus dem Höhenfeld (Krater werfen Licht und Schatten)
  vec3 t1 = normalize(abs(n.y) < 0.99 ? cross(n, vec3(0.0, 1.0, 0.0)) : cross(n, vec3(1.0, 0.0, 0.0)));
  vec3 t2 = cross(n, t1);
  float eps = 0.003;
  float h0 = surfaceHeight(n);
  float h1 = surfaceHeight(normalize(n + t1 * eps));
  float h2 = surfaceHeight(normalize(n + t2 * eps));
  vec3 grad = t1 * (h1 - h0) / eps + t2 * (h2 - h0) / eps;
  vec3 N = normalize(n - grad * 0.38);

  vec3 light = normalize(vec3(-0.35, 0.55, 0.8));
  float diffuse = max(dot(N, light), 0.0);
  float cavity = smoothstep(-0.12, 0.02, h0);
  float tone = fbm(n * 3.0 + 7.0);

  vec3 deep = vec3(0.01, 0.2, 0.11);
  vec3 mid = vec3(0.12, 0.8, 0.5);
  vec3 bright = vec3(0.5, 1.0, 0.75);
  vec3 col = mix(deep, mid, clamp(diffuse * 1.1 + 0.2, 0.0, 1.0));
  col = mix(col, bright, pow(diffuse, 5.0) * 0.5);
  col *= mix(0.7, 1.0, cavity) * (0.85 + 0.3 * tone);

  // Unterseite etwas dunkler + leuchtende Atmosphäre am Planetenrand
  col *= mix(0.68, 1.0, smoothstep(-0.9, 0.3, n.y) * smoothstep(0.0, 0.35, z));
  col += vec3(0.2, 1.0, 0.6) * pow(1.0 - z, 3.0) * 0.45;

  gl_FragColor = vec4(col * alpha, alpha);
}
`

const FLAME_SHADER = `
uniform float uTime;
uniform sampler2D uSurface;

void main() {
  vec2 p = planetCoord();
  float r = length(p);
  vec4 surface = texture2D(uSurface, vUv);

  if (r < 0.85) {
    gl_FragColor = surface;
    return;
  }
  if (r > uExtent) {
    gl_FragColor = vec4(0.0);
    return;
  }

  vec2 dir = p / r;
  float d = max(r - 1.0, 0.0);

  // Flammen steigen vor allem aus der oberen Hälfte auf
  float up = 0.2 + 0.9 * smoothstep(-0.7, 1.0, dir.y);
  float edgeFade = 1.0 - smoothstep(uExtent - 0.4, uExtent, r);

  // Rauschen ist in Umfangsrichtung feiner als nach außen -> lange Flammenzungen,
  // die mit der Zeit nach außen wandern
  vec3 q = vec3(dir * 3.4, d * 1.5 - uTime * 0.55);
  float warp = fbm(q * 1.3 + vec3(0.0, 0.0, -uTime * 0.25));
  float n = fbm(q * 1.8 + warp * 1.8);
  float f = clamp((n * up * 2.2 - d * 2.3) * edgeFade, 0.0, 1.0);

  // dunkelgrüne Spitzen -> kräftiges Mint -> heller Kern nur direkt am Rand
  vec3 color = mix(vec3(0.0, 0.3, 0.15), vec3(0.12, 0.92, 0.55), smoothstep(0.05, 0.45, f));
  color = mix(color, vec3(0.7, 1.0, 0.85), smoothstep(0.75, 1.0, f) * 0.8);
  float alpha = smoothstep(0.03, 0.4, f) * 0.95;

  float glow = exp(-d * 4.0) * 0.35 * up * edgeFade;
  vec4 flame = vec4(color * alpha, alpha);
  vec4 halo = vec4(vec3(0.12, 0.85, 0.55) * glow, glow);
  vec4 back = flame + halo * (1.0 - flame.a);

  // Flackerndes Licht der Flammen auf dem Planetenrand
  vec3 rimLight = color * f * smoothstep(0.88, 1.0, r) * 0.45 * surface.a;

  gl_FragColor = vec4(surface.rgb + rimLight, surface.a) + back * (1.0 - surface.a);
}
`

export interface PlanetRenderer {
  resize(size: number): void
  render(time: number): void
  dispose(): void
}

function createProgram(gl: WebGLRenderingContext, fragmentSource: string) {
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)
    if (!shader) return null
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader))
      gl.deleteShader(shader)
      return null
    }
    return shader
  }

  const vertex = compile(gl.VERTEX_SHADER, VERTEX_SHADER)
  const fragment = compile(gl.FRAGMENT_SHADER, COMMON + fragmentSource)
  const program = gl.createProgram()
  if (!vertex || !fragment || !program) return null

  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.bindAttribLocation(program, 0, 'aPos')
  gl.linkProgram(program)
  gl.deleteShader(vertex)
  gl.deleteShader(fragment)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program))
    gl.deleteProgram(program)
    return null
  }
  return program
}

export function createPlanetRenderer(canvas: HTMLCanvasElement): PlanetRenderer | null {
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false })
  if (!gl) return null

  const surfaceProgram = createProgram(gl, SURFACE_SHADER)
  const flameProgram = createProgram(gl, FLAME_SHADER)
  if (!surfaceProgram || !flameProgram) return null

  // Ein Dreieck, das den ganzen Canvas abdeckt
  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

  const surfaceTexture = gl.createTexture()
  const framebuffer = gl.createFramebuffer()

  const flameTime = gl.getUniformLocation(flameProgram, 'uTime')
  gl.useProgram(flameProgram)
  gl.uniform1f(gl.getUniformLocation(flameProgram, 'uExtent'), EXTENT)
  gl.uniform1i(gl.getUniformLocation(flameProgram, 'uSurface'), 0)

  let size = 0

  return {
    resize(newSize) {
      if (newSize === size || newSize <= 0) return
      size = canvas.width = canvas.height = newSize

      gl.bindTexture(gl.TEXTURE_2D, surfaceTexture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

      // Oberfläche einmalig in die Textur rendern
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        surfaceTexture,
        0,
      )
      gl.viewport(0, 0, size, size)
      gl.useProgram(surfaceProgram)
      gl.uniform1f(gl.getUniformLocation(surfaceProgram, 'uExtent'), EXTENT)
      gl.uniform1f(gl.getUniformLocation(surfaceProgram, 'uPixel'), (3 * EXTENT) / size)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    },

    render(time) {
      if (!size) return
      gl.viewport(0, 0, size, size)
      gl.useProgram(flameProgram)
      gl.uniform1f(flameTime, time)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, surfaceTexture)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    },

    dispose() {
      gl.deleteTexture(surfaceTexture)
      gl.deleteFramebuffer(framebuffer)
      gl.deleteBuffer(buffer)
      gl.deleteProgram(surfaceProgram)
      gl.deleteProgram(flameProgram)
    },
  }
}
