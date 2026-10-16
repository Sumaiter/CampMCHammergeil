// WebGL-Renderer für den Planeten: sich drehende Kraterkugel + animierte grüne Flammen.
//
// Die Oberfläche ist teuer (Krater, Licht, Schatten) und ändert sich nicht – sie wird einmal als
// Rundum-Textur (equirektangulär: Normale + Helligkeit) gebacken. Pro Frame wird diese Textur
// gedreht auf die Kugel gelegt und beleuchtet, dazu kommen die Flammen.

import type { WeatherCondition, WeatherScene } from '@/api/types'
import { buildCampMesh, FLOATS_PER_VERTEX } from './campMesh'

// Canvas ist EXTENT-mal so breit wie der Planet, damit die Flammen Platz haben.
export const EXTENT = 1.9

// Sekunden für eine Umdrehung um die senkrechte Achse; Wolken sind etwas langsamer
const ROTATION_PERIOD = 60
const CLOUD_PERIOD = ROTATION_PERIOD / 0.8

export type RotationAngles = { planet: number; clouds: number }

// Drehwinkel (Radiant) – jeder läuft mit seiner eigenen Periode über, damit nichts springt
export function rotationAngles(seconds: number): RotationAngles {
  const turn = (period: number) => ((seconds % period) / period) * 2 * Math.PI
  return { planet: turn(ROTATION_PERIOD), clouds: turn(CLOUD_PERIOD) }
}

// Zeilen der Rundum-Textur, die als Nächstes gebacken werden (8 Streifen)
export function bakeStrip(done: number, height: number): { y: number; height: number } {
  return { y: done, height: Math.min(Math.ceil(height / 8), height - done) }
}

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

const float PI = 3.14159265;
const float TAU = 6.28318531;
// Helligkeitsfaktor der Oberfläche liegt in 0..1.15 und wird für die Textur auf 0..1 gestaucht
const float SHADE_SCALE = 1.15;
// Wertebereich von surfaceHeight für die 16-Bit-Höhentextur (mit Reserve)
const float HEIGHT_MIN = -0.6;
const float HEIGHT_RANGE = 0.9;

// Richtung auf der Kugel zu einer Position der Rundum-Textur (x = Länge, y = Breite)
vec3 sphereDir(vec2 uv) {
  float lon = (uv.x - 0.5) * TAU;
  float lat = (uv.y - 0.5) * PI;
  return vec3(cos(lat) * sin(lon), sin(lat), cos(lat) * cos(lon));
}

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

const BAKE_SHADER = `

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


// Durchgang 1: nur die Höhe, mit 16 Bit auf R (grob) und G (fein) verteilt. surfaceHeight wird
// hier genau einmal aufgerufen – drei Aufrufe ließen den Shader unter Windows (Direct3D)
// sekundenlang kompilieren, weil jeder Aufruf mit allen Krater-Schleifen ausgerollt wird.
void main() {
  float hp = clamp((surfaceHeight(sphereDir(vUv)) - HEIGHT_MIN) / HEIGHT_RANGE, 0.0, 1.0);
  gl_FragColor = vec4(floor(hp * 255.0) / 255.0, fract(hp * 255.0), 0.0, 1.0);
}
`

// Durchgang 2: Rundum-Textur mit fertiger Normale (Objektkoordinaten) und Helligkeitsfaktor aus
// Kraterhöhlen und Gesteinston. Die Normale kommt aus den Höhen der Nachbar-Texel.
const NORMAL_SHADER = `
uniform sampler2D uHeight;
uniform vec2 uTexel;

float heightAt(vec2 uv) {
  vec4 t = texture2D(uHeight, uv);
  return (t.r + t.g / 255.0) * HEIGHT_RANGE + HEIGHT_MIN;
}

void main() {
  float lon = (vUv.x - 0.5) * TAU;
  float lat = (vUv.y - 0.5) * PI;
  vec3 n = sphereDir(vUv);
  vec3 east = vec3(cos(lon), 0.0, -sin(lon));
  vec3 north = vec3(-sin(lat) * sin(lon), cos(lat), -sin(lat) * cos(lon));

  // Bogenlänge eines Texels nach Osten bzw. Norden (an den Polen begrenzt)
  float stepEast = TAU * uTexel.x * max(cos(lat), 0.02);
  float stepNorth = PI * uTexel.y;

  float h0 = heightAt(vUv);
  float dEast = heightAt(vUv + vec2(uTexel.x, 0.0)) - heightAt(vUv - vec2(uTexel.x, 0.0));
  float dNorth = heightAt(vUv + vec2(0.0, uTexel.y)) - heightAt(vUv - vec2(0.0, uTexel.y));
  vec3 grad = east * dEast / (2.0 * stepEast) + north * dNorth / (2.0 * stepNorth);
  vec3 N = normalize(n - grad * 0.38);

  float cavity = smoothstep(-0.12, 0.02, h0);
  float tone = fbm(n * 3.0 + 7.0);
  float shade = mix(0.7, 1.0, cavity) * (0.85 + 0.3 * tone) / SHADE_SCALE;

  gl_FragColor = vec4(N * 0.5 + 0.5, shade);
}
`

const FRAME_SHADER = `
uniform float uTime;
uniform float uAngle;
uniform float uCloudAngle;
uniform float uPixel;
uniform sampler2D uSurface;
// Wetter: 0 klar, 1 bewölkt, 2 Nebel, 3 Regen, 4 Schnee, 5 Gewitter; Stärke 0..1
uniform float uWeather;
uniform float uIntensity;
// 0 bei prefers-reduced-motion: kein Niederschlag, keine Blitze
uniform float uMotion;

// Dreht um die senkrechte Achse; positive Winkel schieben die Vorderseite nach rechts
vec3 rotateY(vec3 v, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z);
}

// Beleuchtete Kugel (vormultipliziertes RGBA)
vec4 planet(vec2 p, float r) {
  float alpha = 1.0 - smoothstep(1.0 - uPixel, 1.0, r);
  if (alpha <= 0.0) return vec4(0.0);

  vec2 pc = p / max(r, 1.0);
  float z = sqrt(max(1.0 - dot(pc, pc), 0.0));
  vec3 n = vec3(pc, z);

  vec3 obj = rotateY(n, -uAngle);
  vec2 uv = vec2(atan(obj.x, obj.z) / TAU + 0.5, asin(clamp(obj.y, -1.0, 1.0)) / PI + 0.5);
  vec4 surface = texture2D(uSurface, uv);
  vec3 N = rotateY(normalize(surface.xyz * 2.0 - 1.0), uAngle);
  float shade = surface.a * SHADE_SCALE;

  vec3 light = normalize(vec3(-0.35, 0.55, 0.8));
  float diffuse = max(dot(N, light), 0.0);

  vec3 deep = vec3(0.01, 0.2, 0.11);
  vec3 mid = vec3(0.12, 0.8, 0.5);
  vec3 bright = vec3(0.5, 1.0, 0.75);
  vec3 col = mix(deep, mid, clamp(diffuse * 1.1 + 0.2, 0.0, 1.0));
  col = mix(col, bright, pow(diffuse, 5.0) * 0.5);
  col *= shade;

  // Unterseite etwas dunkler + leuchtende Atmosphäre am Planetenrand
  col *= mix(0.68, 1.0, smoothstep(-0.9, 0.3, n.y) * smoothstep(0.0, 0.35, z));
  col += vec3(0.2, 1.0, 0.6) * pow(1.0 - z, 3.0) * 0.45;

  return vec4(col * alpha, alpha);
}

// Richtung zum Camp in Objektkoordinaten (35° nördliche Breite, Länge 0 – siehe campMesh.ts)
const vec3 CAMP_DIR = vec3(0.0, 0.573576, 0.819152);

// 0 direkt am Camp, 1 ab ~18° Abstand: dort lodern keine Flammen
float campClearance(vec3 obj) {
  return 1.0 - smoothstep(0.951057, 0.978148, dot(obj, CAMP_DIR));
}

// ---------- Wetter am Nürburgring ----------

const vec3 LIGHT = vec3(-0.3487, 0.5480, 0.7971); // normalize(-0.35, 0.55, 0.8)

bool isWeather(float id) {
  return abs(uWeather - id) < 0.5;
}

float cloudCover() {
  if (isWeather(1.0)) return uIntensity;
  if (uWeather > 2.5) return 0.5 + 0.5 * uIntensity; // Regen, Schnee, Gewitter
  return 0.0;
}

// Blitz: zufällig in manchen halben Sekunden, schnell abklingend
float lightning() {
  if (!isWeather(5.0) || uMotion < 0.5) return 0.0;
  float slot = floor(uTime * 2.0);
  float strike = step(0.93, hash13(vec3(slot, 3.1, 7.7)));
  float decay = 1.0 - fract(uTime * 2.0);
  return strike * decay * decay;
}

// Wolken und Nebel liegen auf der Kugel; Wolken drehen etwas langsamer als der Planet
vec4 weatherOnSurface(vec4 surface, vec2 p, float r) {
  if (surface.a <= 0.0 || r >= 1.0) return surface;
  vec3 n = vec3(p, sqrt(1.0 - r * r));

  float cover = cloudCover();
  if (cover > 0.0) {
    vec3 obj = rotateY(n, -uCloudAngle);
    float c = fbm(obj * vec3(2.2, 4.0, 2.2)); // flach gestreckte Bänder
    float density = smoothstep(0.55 - 0.2 * cover, 0.72, c) * (0.4 + 0.4 * cover);
    vec3 cloud = uWeather > 2.5 ? vec3(0.5, 0.56, 0.55) : vec3(0.95, 0.98, 0.97);
    cloud *= 0.55 + 0.45 * max(dot(n, LIGHT), 0.0) + lightning() * 0.8;
    surface.rgb = mix(surface.rgb, cloud * surface.a, density);
  }

  if (isWeather(2.0)) {
    surface.rgb = mix(surface.rgb, vec3(0.75, 0.85, 0.8) * surface.a, 0.35 * uIntensity);
  }
  return surface;
}

// Regenstreifen: schräg, schnell, in Spalten mit Zufallsversatz
float rainLayer(vec2 p, float cell, float speed, float seed) {
  vec2 q = vec2(p.x + p.y * 0.25, p.y);
  float column = floor(q.x / cell);
  vec3 rnd = hash33(vec3(column, seed, 1.0));
  if (rnd.x > 0.35 + 0.6 * uIntensity) return 0.0;
  float along = fract((q.y + uTime * speed * (0.8 + 0.4 * rnd.y)) / 0.6 + rnd.z);
  float streak = smoothstep(0.0, 0.05, along) * (1.0 - smoothstep(0.12, 0.2, along));
  float across = abs(fract(q.x / cell) - 0.5) * cell;
  return streak * (1.0 - smoothstep(0.0, 0.006, across));
}

// Schneeflocken: langsam, leicht pendelnd
float snowLayer(vec2 p, float cell, float speed, float seed) {
  vec2 q = p + vec2(0.0, uTime * speed);
  vec2 id = floor(q / cell);
  vec3 rnd = hash33(vec3(id, seed));
  if (rnd.z > 0.25 + 0.6 * uIntensity) return 0.0;
  vec2 center = (id + 0.2 + 0.6 * rnd.xy) * cell;
  center.x += sin(uTime * 1.3 + rnd.x * 6.3) * cell * 0.15;
  float size = cell * (0.08 + 0.06 * rnd.y);
  return 1.0 - smoothstep(size * 0.4, size, length(q - center));
}

// Nebel-Dunst, Niederschlag und Blitz liegen vor der ganzen Szene
vec4 weatherInFront(vec4 color, vec2 p, float r) {
  float fade = 1.0 - smoothstep(uExtent - 0.4, uExtent, r);
  if (fade <= 0.0) return color;

  if (isWeather(2.0)) {
    float haze = 0.3 * uIntensity * exp(-max(r - 1.0, 0.0) * 4.0) * (1.0 - smoothstep(1.0, 1.4, r));
    color += vec4(vec3(0.75, 0.85, 0.8) * haze, haze) * (1.0 - color.a);
  }

  if (uMotion < 0.5) return color;

  float drops = 0.0;
  vec3 tint = vec3(0.7, 0.85, 0.95);
  if (isWeather(3.0) || isWeather(5.0)) {
    drops = rainLayer(p, 0.045, 3.2, 1.0) * 0.55 + rainLayer(p * 1.3 + 7.0, 0.04, 2.4, 2.0) * 0.3;
  } else if (isWeather(4.0)) {
    drops = snowLayer(p, 0.16, 0.25, 1.0) * 0.9 + snowLayer(p * 1.4 + 3.0, 0.14, 0.17, 2.0) * 0.6;
    tint = vec3(0.95, 1.0, 0.98);
  }
  drops *= fade;
  color = vec4(tint * drops, drops) + color * (1.0 - drops);

  float flash = lightning() * 0.35 * fade * (1.0 - smoothstep(0.6, uExtent, r));
  return color + vec4(vec3(0.75, 0.85, 0.9) * flash, flash) * (1.0 - color.a * 0.5);
}

// Dünnes Lodern auf der Vorderseite: hängt an der Oberfläche und züngelt nach oben.
// Zur Mitte hin (hinter dem Schriftzug) schwächer, damit die Schrift lesbar bleibt.
float surfaceFlames(vec2 p, float r) {
  if (r >= 1.0) return 0.0;
  vec3 obj = rotateY(vec3(p, sqrt(1.0 - r * r)), -uAngle);
  // senkrecht gestreckt -> schmale Zungen, die nach oben wandern
  float lick = fbm(vec3(obj.x * 7.0, obj.y * 2.5 - uTime * 0.6, obj.z * 7.0));
  return smoothstep(0.55, 0.72, lick) * 0.45 * smoothstep(0.35, 0.95, r) * campClearance(obj);
}

// Planet mit Flammen (vormultipliziertes RGBA)
vec4 scene(vec2 p, float r) {
  vec4 surface = planet(p, r);
  surface.rgb += vec3(0.12, 0.92, 0.55) * surfaceFlames(p, r) * surface.a;
  surface = weatherOnSurface(surface, p, r);

  if (r < 0.85) return surface;
  if (r > uExtent) return vec4(0.0);

  vec2 dir = p / r;
  float d = max(r - 1.0, 0.0);

  // Flammen steigen vor allem aus der oberen Hälfte auf. Wie hoch sie schlagen, hängt an der
  // Stelle des Planeten, die gerade am Rand steht – so drehen die Flammenherde mit.
  vec3 limb = rotateY(vec3(dir, 0.0), -uAngle);
  float strength = (0.55 + 0.9 * fbm(limb * 2.2 + 5.0)) * campClearance(limb);
  float up = (0.2 + 0.9 * smoothstep(-0.7, 1.0, dir.y)) * strength;
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

  return vec4(surface.rgb + rimLight, surface.a) + back * (1.0 - surface.a);
}

void main() {
  vec2 p = planetCoord();
  float r = length(p);
  gl_FragColor = weatherInFront(scene(p, r), p, r);
}
`

// Zelte und Pavillon: kleine Dreiecksmodelle, gleiche Drehung und Projektion wie die Kugel
const CAMP_VERTEX_SHADER = `
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec3 aColor;
uniform float uAngle;
uniform float uExtent;
varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vColor;

vec3 rotateY(vec3 v, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z);
}

void main() {
  vPosition = rotateY(aPosition, uAngle);
  vNormal = rotateY(aNormal, uAngle);
  vColor = aColor;
  // orthografisch wie die Kugel; näher am Betrachter (größeres z) = kleinere Tiefe
  gl_Position = vec4(vPosition.xy / uExtent, -vPosition.z * 0.5, 1.0);
}
`

const CAMP_FRAGMENT_SHADER = `
precision mediump float;
varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vColor;

void main() {
  // Hinter der Kugel? Dann verdeckt der Planet das Zelt.
  float r2 = dot(vPosition.xy, vPosition.xy);
  if (r2 < 1.0 && vPosition.z < sqrt(1.0 - r2)) discard;

  vec3 light = normalize(vec3(-0.35, 0.55, 0.8));
  float diffuse = max(dot(normalize(vNormal), light), 0.0);
  vec3 col = vColor * (0.3 + 0.75 * diffuse) + vec3(0.02, 0.08, 0.05);
  gl_FragColor = vec4(col, 1.0);
}
`

export interface PlanetRenderer {
  resize(size: number): void
  // time treibt Flammen & Co. (bei reducedMotion eingefroren), angle (Radiant) die Drehung
  render(time: number, angles: RotationAngles): void
  // null = keine Wettereffekte
  setWeather(scene: WeatherScene | null): void
  dispose(): void
}

// Muss zu uWeather im Shader passen
const WEATHER_IDS: Record<WeatherCondition, number> = {
  clear: 0,
  cloudy: 1,
  fog: 2,
  rain: 3,
  snow: 4,
  storm: 5,
}

export interface PlanetRendererOptions {
  reducedMotion: boolean
  // Shader ließen sich nicht linken (erst nach dem Kompilieren im Hintergrund bekannt)
  onUnsupported?: () => void
}

// Breite der Rundum-Textur: ~2,5 Texel pro Planeten-Pixel, als Zweierpotenz (für REPEAT)
function surfaceTextureWidth(planetPixels: number, maxTextureSize: number): number {
  let width = 512
  while (width < planetPixels * 2.5 && width < 2048) width *= 2
  return Math.min(width, maxTextureSize)
}

function createProgram(
  gl: WebGLRenderingContext,
  fragmentSource: string,
  vertexSource = VERTEX_SHADER,
  attributes = ['aPos'],
) {
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)
    if (!shader) return null
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    return shader
  }

  // Kein Status abfragen – das würde warten, bis der Treiber fertig kompiliert hat
  const vertex = compile(gl.VERTEX_SHADER, vertexSource)
  const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource)
  const program = gl.createProgram()
  if (!vertex || !fragment || !program) return null

  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  attributes.forEach((name, location) => gl.bindAttribLocation(program, location, name))
  gl.linkProgram(program)
  return { program, shaders: [vertex, fragment] }
}

type PendingProgram = NonNullable<ReturnType<typeof createProgram>>

// Prüft das Ergebnis eines fertig gelinkten Programms (blockiert, falls noch nicht fertig)
function finishProgram(gl: WebGLRenderingContext, { program, shaders }: PendingProgram) {
  const ok = gl.getProgramParameter(program, gl.LINK_STATUS) as boolean
  if (!ok) {
    for (const shader of shaders) console.error(gl.getShaderInfoLog(shader))
    console.error(gl.getProgramInfoLog(program))
  }
  for (const shader of shaders) gl.deleteShader(shader)
  return ok
}

export function createPlanetRenderer(
  canvas: HTMLCanvasElement,
  options: PlanetRendererOptions,
): PlanetRenderer | null {
  const gl = canvas.getContext('webgl', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: true, // für die Zelte untereinander
  })
  if (!gl) return null

  // Unter Windows (Direct3D) dauert das Kompilieren der Shader spürbar. Mit dieser Erweiterung
  // passiert es im Hintergrund, die Seite bleibt bedienbar und bis dahin ist der CSS-Planet zu sehen.
  const parallelCompile = gl.getExtension('KHR_parallel_shader_compile')

  const pending = [
    createProgram(gl, COMMON + BAKE_SHADER),
    createProgram(gl, COMMON + NORMAL_SHADER),
    createProgram(gl, COMMON + FRAME_SHADER),
    createProgram(gl, CAMP_FRAGMENT_SHADER, CAMP_VERTEX_SHADER, ['aPosition', 'aNormal', 'aColor']),
  ]
  if (pending.some((p) => !p)) return null
  const [bake, normal, frame, camp] = pending as PendingProgram[]
  const bakeProgram = bake!.program
  const normalProgram = normal!.program
  const frameProgram = frame!.program
  const campProgram = camp!.program

  // Ein Dreieck, das den ganzen Canvas abdeckt
  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)

  const campMesh = buildCampMesh()
  const campVertices = campMesh.length / FLOATS_PER_VERTEX
  const campBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, campBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, campMesh, gl.STATIC_DRAW)

  // WebGL 1 hat keine Vertex Arrays – Attribute vor jedem Zeichnen neu setzen
  const useFullscreenTriangle = () => {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    gl.disableVertexAttribArray(1)
    gl.disableVertexAttribArray(2)
  }

  const useCampMesh = () => {
    const stride = FLOATS_PER_VERTEX * 4
    gl.bindBuffer(gl.ARRAY_BUFFER, campBuffer)
    for (let i = 0; i < 3; i++) {
      gl.enableVertexAttribArray(i)
      gl.vertexAttribPointer(i, 3, gl.FLOAT, false, stride, i * 12)
    }
  }

  const heightTexture = gl.createTexture()
  const surfaceTexture = gl.createTexture()
  const framebuffer = gl.createFramebuffer()
  const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number

  // Uniforms erst nach dem Linken einrichten – jeder Zugriff vorher würde auf den Treiber warten
  const setupUniforms = () => {
    const at = (program: WebGLProgram, name: string) => gl.getUniformLocation(program, name)

    gl.useProgram(normalProgram)
    gl.uniform1i(at(normalProgram, 'uHeight'), 0)

    gl.useProgram(frameProgram)
    gl.uniform1f(at(frameProgram, 'uMotion'), options.reducedMotion ? 0 : 1)
    gl.uniform1f(at(frameProgram, 'uExtent'), EXTENT)
    gl.uniform1i(at(frameProgram, 'uSurface'), 0)

    gl.useProgram(campProgram)
    gl.uniform1f(at(campProgram, 'uExtent'), EXTENT)

    return {
      normalTexel: at(normalProgram, 'uTexel'),
      frameTime: at(frameProgram, 'uTime'),
      frameAngle: at(frameProgram, 'uAngle'),
      frameCloudAngle: at(frameProgram, 'uCloudAngle'),
      framePixel: at(frameProgram, 'uPixel'),
      frameWeather: at(frameProgram, 'uWeather'),
      frameIntensity: at(frameProgram, 'uIntensity'),
      campAngle: at(campProgram, 'uAngle'),
    }
  }

  let uniforms: ReturnType<typeof setupUniforms> | null = null
  let failed = false

  // true, sobald alle Programme gelinkt und eingerichtet sind
  const ensureReady = () => {
    if (uniforms) return true
    if (failed) return false
    const done = (p: PendingProgram) =>
      gl.getProgramParameter(p.program, parallelCompile!.COMPLETION_STATUS_KHR) as boolean
    if (parallelCompile && !pending.every((p) => done(p!))) return false

    if (!pending.every((p) => finishProgram(gl, p!))) {
      failed = true
      options.onUnsupported?.()
      return false
    }
    uniforms = setupUniforms()
    return true
  }

  let weather = { id: 0, intensity: 0 }
  let size = 0
  let textureWidth = 0
  let textureHeight = 0
  let bakedRows = 0
  let surfaceReady = false

  // Höhenwerte sind auf zwei Kanäle verteilt – nicht interpolieren, sonst stimmt das Entpacken nicht
  const setupTexture = (texture: WebGLTexture | null, filter: number) => {
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      textureWidth,
      textureHeight,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    )
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  }

  // Rundum-Texturen anlegen; gefüllt werden sie in den nächsten Frames
  const allocateSurface = (width: number) => {
    textureWidth = width
    textureHeight = width / 2
    bakedRows = 0
    surfaceReady = false
    setupTexture(heightTexture, gl.NEAREST)
    setupTexture(surfaceTexture, gl.LINEAR)
  }

  const drawInto = (texture: WebGLTexture | null, program: WebGLProgram) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
    gl.viewport(0, 0, textureWidth, textureHeight)
    gl.useProgram(program)
    useFullscreenTriangle()
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  // Ein Streifen der teuren Kraterhöhen pro Frame – so blockiert schwache Handys kein
  // einzelner riesiger Draw-Call (bis dahin bleibt der CSS-Planet sichtbar).
  const bakeNextStrip = () => {
    const strip = bakeStrip(bakedRows, textureHeight)
    gl.enable(gl.SCISSOR_TEST)
    gl.scissor(0, strip.y, textureWidth, strip.height)
    drawInto(heightTexture, bakeProgram)
    gl.disable(gl.SCISSOR_TEST)
    bakedRows = strip.y + strip.height
  }

  // Normalen aus den fertigen Höhen – billig, daher in einem Zug
  const bakeNormals = (u: NonNullable<typeof uniforms>) => {
    gl.useProgram(normalProgram)
    gl.uniform2f(u.normalTexel, 1 / textureWidth, 1 / textureHeight)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, heightTexture)
    drawInto(surfaceTexture, normalProgram)
    surfaceReady = true
  }

  return {
    resize(newSize) {
      if (newSize === size || newSize <= 0) return
      size = canvas.width = canvas.height = newSize

      const width = surfaceTextureWidth(size / EXTENT, maxTextureSize)
      if (width !== textureWidth) allocateSurface(width)
    },

    setWeather(scene) {
      weather = { id: scene ? WEATHER_IDS[scene.condition] : 0, intensity: scene?.intensity ?? 0 }
    },

    render(time, angles) {
      if (!size || !ensureReady()) return
      const u = uniforms!
      if (bakedRows < textureHeight) {
        bakeNextStrip()
        gl.viewport(0, 0, size, size)
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)
        return
      }
      if (!surfaceReady) bakeNormals(u)

      gl.viewport(0, 0, size, size)
      gl.useProgram(frameProgram)
      gl.uniform1f(u.frameTime, options.reducedMotion ? 0 : time)
      gl.uniform1f(u.frameAngle, angles.planet)
      gl.uniform1f(u.frameCloudAngle, angles.clouds)
      gl.uniform1f(u.framePixel, (3 * EXTENT) / size)
      gl.uniform1f(u.frameWeather, weather.id)
      gl.uniform1f(u.frameIntensity, weather.intensity)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, surfaceTexture)
      useFullscreenTriangle()
      gl.drawArrays(gl.TRIANGLES, 0, 3)

      gl.useProgram(campProgram)
      gl.uniform1f(u.campAngle, angles.planet)
      useCampMesh()
      gl.clear(gl.DEPTH_BUFFER_BIT)
      gl.enable(gl.DEPTH_TEST)
      gl.drawArrays(gl.TRIANGLES, 0, campVertices)
      gl.disable(gl.DEPTH_TEST)
    },

    dispose() {
      gl.deleteTexture(heightTexture)
      gl.deleteTexture(surfaceTexture)
      gl.deleteFramebuffer(framebuffer)
      gl.deleteBuffer(buffer)
      gl.deleteBuffer(campBuffer)
      gl.deleteProgram(bakeProgram)
      gl.deleteProgram(normalProgram)
      gl.deleteProgram(frameProgram)
      gl.deleteProgram(campProgram)
    },
  }
}
