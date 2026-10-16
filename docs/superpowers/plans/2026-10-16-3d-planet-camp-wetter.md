# 3D-Planet mit Camp und Nürburgring-Wetter – Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Der Header-Planet wird eine sich drehende 3D-Kugel mit mitdrehenden Flammen und einem kleinen Zelt-Camp; das Nürburgring-Wetter wird als Wetterstation angezeigt und optional als Szene-Effekt dargestellt.

**Architecture:** Der bestehende WebGL-1-Renderer backt die Kraterlandschaft einmal als equirektanguläre Normalen-Textur und dreht sie pro Frame auf der Kugel; Flammen, Wolken und Niederschlag sind Rauschen im Frame-Shader, das Camp ist ein winziges Dreiecksmodell in einem zweiten Programm. Wetterdaten kommen über eine neue Worker-Route (`/api/weather`, Proxy auf Open-Meteo mit 15-min-Cache) und einen geteilten Vue-Zustand `useWeather` mit localStorage-Cache.

**Tech Stack:** Vue 3 + TypeScript, WebGL 1 (GLSL ES 1.0), Hono auf Cloudflare Workers, Vitest (Projekte `worker` und `web`).

**Spec:** `docs/superpowers/specs/2026-10-16-3d-planet-camp-wetter-design.md`

## Global Constraints

- Keine neuen Abhängigkeiten (kein Three.js), keine nachzuladenden Bilder/Modelle.
- Drehachse exakt senkrecht (y-Achse), keine Neigung; Planet dreht **immer**, ca. 1 Umdrehung / 60 s; `float`-Animation entfällt.
- `prefers-reduced-motion`: Drehung läuft weiter; Flammen-Flackern, Tropfen/Flocken und Blitze entfallen.
- Pausieren nur, solange der Planet aus dem Bild gescrollt ist (bestehender IntersectionObserver).
- Ohne WebGL: bisheriger CSS-Farbverlauf; Wetterstation funktioniert trotzdem.
- Nürburgring: `latitude=50.3356`, `longitude=6.9475`, `timezone=Europe/Berlin`, `forecast_days=4`.
- Worker-Cache 15 min (`caches.default`), Antwort-Header `Cache-Control: public, max-age=300`, Upstream-Timeout 5 s, Fehler → 502 `{ error: 'Wetter nicht verfügbar' }`.
- localStorage-Schlüssel: `weather:last` (letzte Antwort), `weather:effects` (`'0'`/`'1'`, Standard an).
- Texte auf Deutsch, Code-Kommentare auf Deutsch im Stil der umliegenden Dateien.
- Dev-Server Port 5180 (`npm run dev`); niemals 5173.

## Review Focus

1. **Gespeicherter localStorage-Stand ist kaputt oder aus alter Version** (kein JSON, fehlende Felder) → wird ignoriert, keine Exception. Test in Task 3.
2. **Open-Meteo liefert 200 mit unerwartetem Format** (z. B. `current` fehlt) → 502, nichts wird gecacht. Test in Task 2.
3. **Unbekannter WMO-Code** (z. B. 4 oder 100) → `cloudy`/0.5, kein Absturz. Test in Task 1.
4. **Tab war lange im Hintergrund / Gerät offline** → beim Zurückkehren wird neu geladen; schlägt das fehl, bleibt alter Stand mit „Stand HH:MM“. Test in Task 3 (`isStale`).
5. **WebGL-Kontextverlust oder sehr kleine Canvas-Größe** (z. B. Breite 0 beim Start) → kein Bake mit Größe 0, Fallback greift. Abgedeckt durch die bestehende `newSize <= 0`-Prüfung, die beim Umbau in Task 5 erhalten bleiben muss.

---

## Dateistruktur

| Datei | Verantwortung |
|---|---|
| `worker/lib/weatherCode.ts` (neu) | WMO-Code → `{ condition, intensity }` |
| `worker/routes/weather.ts` (neu) | `GET /api/weather`: Upstream holen, umformen, cachen |
| `worker/index.ts` | Route einhängen |
| `src/api/types.ts` | `WeatherCondition`, `WeatherScene`, `Weather` |
| `src/weather/useWeather.ts` (neu) | geteilter Zustand, localStorage, Aktualisierung, Schalter |
| `src/weather/emoji.ts` (neu) | Zustand + Tag/Nacht → Emoji, Wochentag-Format |
| `src/components/Weather/WeatherStation.vue` (neu) | Station oben links, Vorhersage-Panel, Effekt-Schalter |
| `src/components/SiteHeader.vue` | Station einbinden, `float` entfernen, Wetter an Planet reichen |
| `src/components/Planet/planetRenderer.ts` | Bake + Rotation + 3D-Flammen + Wetter-Effekte |
| `src/components/Planet/campMesh.ts` (neu) | Eckpunkte von Zelten und Pavillon |
| `src/components/Planet/PlanetCanvas.vue` | Dauerschleife, Rotationswinkel, `weather`-Prop |
| `DatenschutzPage.vue`, `CookieConsent.vue`, `CreditsPage.vue` | Texte |

---

### Task 1: WMO-Code-Übersetzung

**Files:**
- Create: `worker/lib/weatherCode.ts`
- Test: `worker/lib/weatherCode.test.ts`

**Interfaces:**
- Produces: `export type WeatherCondition = 'clear' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm'` und `export function mapWeatherCode(code: number): { condition: WeatherCondition; intensity: number }`

- [ ] **Step 1: Failing test schreiben** – `it.each` über die Tabelle der Spec:

```ts
it.each([
  [0, 'clear', 0], [1, 'clear', 0], [2, 'cloudy', 0.5], [3, 'cloudy', 1],
  [45, 'fog', 1], [48, 'fog', 1],
  [51, 'rain', 0.3], [57, 'rain', 0.3], [61, 'rain', 0.3], [80, 'rain', 0.3],
  [63, 'rain', 0.6], [81, 'rain', 0.6],
  [65, 'rain', 1], [66, 'rain', 1], [67, 'rain', 1], [82, 'rain', 1],
  [71, 'snow', 0.3], [77, 'snow', 0.3], [85, 'snow', 0.3], [73, 'snow', 0.6],
  [75, 'snow', 1], [86, 'snow', 1],
  [95, 'storm', 1], [96, 'storm', 1], [99, 'storm', 1],
  [4, 'cloudy', 0.5], [100, 'cloudy', 0.5], [-1, 'cloudy', 0.5],
])('Code %i → %s (%f)', (code, condition, intensity) => {
  expect(mapWeatherCode(code)).toEqual({ condition, intensity })
})
```

- [ ] **Step 2:** `npx vitest run --project worker worker/lib/weatherCode.test.ts` → FAIL (Modul fehlt)
- [ ] **Step 3:** `mapWeatherCode` implementieren (Lookup-Tabelle `Record<number, …>`, Fallback `cloudy`/0.5).
- [ ] **Step 4:** Test erneut → PASS
- [ ] **Step 5:** Commit `feat(worker): WMO-Wettercodes in Wetterzustände übersetzen`

### Task 2: Worker-Route `/api/weather`

**Files:**
- Create: `worker/routes/weather.ts`
- Modify: `worker/index.ts` (`app.route('/api/weather', weatherRoutes)`)
- Test: `worker/test/weather.test.ts`

**Interfaces:**
- Consumes: `mapWeatherCode` (Task 1)
- Produces: `export const weatherRoutes`, `export const WEATHER_CACHE_KEY = 'https://cache.internal/weather'`, JSON-Antwort exakt wie `Weather` in der Spec (`current`, `daily` mit 4 Einträgen heute+3, `updatedAt`). Temperaturen gerundet auf 1 Nachkommastelle wie geliefert (Rundung macht die UI); `rainChance` = `precipitation_probability_max[i] ?? null`; `isDay` = `current.is_day === 1`; `windKmh` = `current.wind_speed_10m`.

- [ ] **Step 1: Failing tests** in `worker/test/weather.test.ts`. `beforeEach`: `await caches.default.delete(WEATHER_CACHE_KEY)`, `vi.spyOn(globalThis, 'fetch')` mit einer Open-Meteo-Beispielantwort (`current: { time, temperature_2m: 17.3, weather_code: 63, is_day: 1, wind_speed_10m: 12.5 }`, `daily` mit 4 Tagen). Tests:
  - `liefert kompaktes Wetter` → Status 200, `body.current` = `{ temperature: 17.3, condition: 'rain', intensity: 0.6, isDay: true, windKmh: 12.5 }`, `body.daily.length === 4`, `body.daily[0]` = `{ date: '2026-10-16', condition: …, max, min, rainChance }`, `typeof body.updatedAt === 'string'`, Header `Cache-Control` = `public, max-age=300`.
  - `fragt Open-Meteo innerhalb von 15 Minuten nur einmal` → zwei Requests, `fetch`-Spy genau 1× mit URL, die `latitude=50.3356` und `longitude=6.9475` enthält.
  - `meldet 502, wenn Open-Meteo ausfällt` → Spy liefert Status 500 → 502 `{ error: 'Wetter nicht verfügbar' }`.
  - `meldet 502 bei unerwartetem Format und cacht nichts` → Spy liefert `{}` → 502; danach liefert der Spy gültige Daten → zweiter Request 200.
  - Hinweis: Prüfen, dass der Spy auch den Fetch des Workers abfängt (Test und Worker laufen im selben Isolate). Falls nicht, die Upstream-Abfrage in `fetchForecast(fetcher = fetch)` auslagern und direkt testen.
- [ ] **Step 2:** `npx vitest run --project worker worker/test/weather.test.ts` → FAIL (404)
- [ ] **Step 3:** Route implementieren: Cache-Treffer zurückgeben; sonst `fetch(url, { signal: AbortSignal.timeout(5000) })`, Format prüfen (`current` und `daily.time` vorhanden, Arrays gleich lang), umformen, als `Response` mit `Cache-Control: public, max-age=900` per `c.executionCtx.waitUntil(caches.default.put(...))` speichern; ausgelieferte Antwort mit `max-age=300`. Fehler → `HttpError(502, 'Wetter nicht verfügbar')`.
- [ ] **Step 4:** Tests → PASS; `npm test` komplett grün.
- [ ] **Step 5:** Commit `feat(worker): Wetter-Route für den Nürburgring mit Cache`

### Task 3: Frontend-Typen und `useWeather`

**Files:**
- Modify: `src/api/types.ts`
- Create: `src/weather/useWeather.ts`
- Test: `src/weather/useWeather.test.ts`

**Interfaces:**
- Produces in `src/api/types.ts`: `WeatherCondition`, `WeatherScene { condition; intensity }`, `Weather` (wie Spec).
- Produces in `useWeather.ts`:
  - `export const REFRESH_MS = 15 * 60_000`, `export const STALE_MS = 60 * 60_000`
  - `export function isStale(weather: Weather, now: number): boolean` (älter als `STALE_MS` laut `updatedAt`)
  - `export function useWeather(): { weather: Readonly<Ref<Weather | null>>; effectsEnabled: Readonly<Ref<boolean>>; scene: ComputedRef<WeatherScene | null>; setEffectsEnabled(on: boolean): void; refresh(): Promise<void>; start(): () => void }`
  - `scene` = `null`, wenn Effekte aus oder keine Daten; sonst `{ condition, intensity }` aus `current`. Im Dev-Build (`import.meta.env.DEV`) überschreibt `?weather=<condition>` (Intensität 1) die Szene.
  - `start()` (einmal aus der Station aufgerufen): sofort `refresh()`, `setInterval(refresh, REFRESH_MS)` nur bei sichtbarem Tab, `visibilitychange` → bei Sichtbarkeit und Stand älter als `REFRESH_MS` sofort `refresh()`; gibt Aufräumfunktion zurück.
  - Zustand ist modulglobal (wie `useAuth`); localStorage wird beim Laden des Moduls gelesen.
- [ ] **Step 1: Failing tests** (Muster wie `src/auth/useAuth.test.ts`: `vi.resetModules()`, `vi.stubGlobal('fetch', …)`, zusätzlich `vi.stubGlobal('localStorage', <Map-basierter Stub>)`):
  - `zeigt gespeicherten Stand sofort` → localStorage `weather:last` gesetzt → `weather.value` direkt nach Import gleich dem gespeicherten Objekt, ohne dass `fetch` aufgerufen wurde.
  - `ignoriert kaputten gespeicherten Stand` → `weather:last = '{kaputt'` und `'{"foo":1}'` → `weather.value === null`, kein Throw.
  - `refresh speichert neue Daten` → nach `refresh()` `weather.value` = Antwort und `localStorage['weather:last']` = JSON davon.
  - `Fehler behält alten Stand` → gespeicherter Stand, `fetch` liefert 502 → nach `refresh()` unverändert, kein Throw.
  - `Schalter wird gespeichert` → `setEffectsEnabled(false)` → `localStorage['weather:effects'] === '0'`, `scene.value === null`; neu importiert bleibt `effectsEnabled.value === false`.
  - `isStale` → `updatedAt` vor 59 min → false, vor 61 min → true.
- [ ] **Step 2:** `npx vitest run --project web src/weather/useWeather.test.ts` → FAIL
- [ ] **Step 3:** Implementieren (Laden über `api.get<Weather>('/api/weather')`; Validierung des gespeicherten Stands: `current.condition` ist String und `daily` ist Array).
- [ ] **Step 4:** Tests → PASS
- [ ] **Step 5:** Commit `feat(web): Wetterzustand mit Offline-Cache und Effekt-Schalter`

### Task 4: Wetterstation, Header und Texte

**Files:**
- Create: `src/weather/emoji.ts`, `src/weather/emoji.test.ts`, `src/components/Weather/WeatherStation.vue`
- Modify: `src/components/SiteHeader.vue`, `src/components/Footer/DatenschutzPage.vue`, `src/components/CookieConsent/CookieConsent.vue`, `src/components/Footer/CreditsPage.vue`

**Interfaces:**
- Consumes: `useWeather` (Task 3)
- Produces: `export function weatherEmoji(condition: WeatherCondition, isDay = true): string`, `export function weekdayLabel(date: string, today: string): string` (`'Heute'`, sonst `'Mo'`…`'So'`)

- [ ] **Step 1: Failing test** `emoji.test.ts`: `clear` Tag `☀️`, Nacht `🌙`; `cloudy` `☁️`; `fog` `🌫️`; `rain` `🌧️`; `snow` `🌨️`; `storm` `⛈️`; `weekdayLabel('2026-10-16','2026-10-16') === 'Heute'`, `weekdayLabel('2026-10-17','2026-10-16') === 'Sa'`.
- [ ] **Step 2:** Test → FAIL; **Step 3:** implementieren; **Step 4:** Test → PASS
- [ ] **Step 5: `WeatherStation.vue`** – Aufbau und Stil spiegelbildlich zum `.satellite` in `SiteHeader.vue` (oben **links**, `env(safe-area-inset-left)`, gleiches Icon-/Label-Styling): Button mit Emoji + `Math.round(temperature)°` (ohne Daten `–°`), Label `NÜRBURGRING`, bei `isStale` zusätzlich `Stand HH:MM`. Button öffnet/schließt ein `glass-card`-Panel (heute + 3 Tage: `weekdayLabel`, Emoji, `max° / min°`, `💧 rainChance %` falls nicht null); schließen bei Klick außerhalb und `Escape`; `aria-expanded`. Darunter Schalter `<button role="switch" :aria-checked="effectsEnabled">Effekte</button>`. `onMounted(() => stop = start())`, `onUnmounted(() => stop())`.
- [ ] **Step 6: `SiteHeader.vue`** – `<WeatherStation />` einfügen; `animation: float …` und `@keyframes float` entfernen; `scene` aus `useWeather()` als `:weather="scene"` an `<PlanetCanvas>` geben (Prop wird in Task 8 genutzt; bis dahin `defineProps<{ weather?: WeatherScene | null }>()` in `PlanetCanvas.vue` ohne Verwendung anlegen). Prüfen, dass Station + Schalter bei 360 px Breite den Planeten nicht überdecken (ggf. Header-`padding-top` erhöhen).
- [ ] **Step 7: Texte**
  - Datenschutz: neuer Abschnitt nach „5. Benutzerkonten“: `<h2>6. Wetterdaten</h2>` – „Für die Wetteranzeige ruft unser Server das Wetter am Nürburgring bei Open-Meteo (open-meteo.com) ab. Dein Browser spricht dabei nur mit unserem Server; an Open-Meteo werden keine Daten über dich übermittelt. Die zuletzt geladenen Wetterdaten und deine Einstellung zu den Wettereffekten werden im localStorage deines Browsers gespeichert.“ Nachfolgende Nummern +1.
  - Cookie-Liste: `<li>Zwischenspeicher für Wetterdaten und Einstellung „Effekte“ (localStorage)</li>`.
  - Credits: neuer Abschnitt `<h2>3. Wetterdaten</h2>` – „Wetterdaten von Open-Meteo.com, lizenziert unter CC BY 4.0.“ mit Link auf `https://open-meteo.com/`; „Hinweise zur Nutzung“ wird 4.
- [ ] **Step 8:** `npm run type-check && npm run lint && npm test` → grün; Browser auf `http://localhost:5180`: Station zeigt Temperatur, Panel öffnet/schließt, Schalter bleibt nach Reload erhalten, Planet schwebt nicht mehr.
- [ ] **Step 9:** Commit `feat(web): Wetterstation Nürburgring im Header`

### Task 5: Rotierender Planet (Bake + Rotation)

**Files:**
- Modify: `src/components/Planet/planetRenderer.ts`, `src/components/Planet/PlanetCanvas.vue`

**Interfaces:**
- Produces: `createPlanetRenderer(canvas, options: { reducedMotion: boolean })`; `render(time: number, angle: number)` – `time` treibt Flammen/Wetter (bei `reducedMotion` intern auf 0 eingefroren), `angle` (Radiant) die Drehung. `export const ROTATION_PERIOD = 60` (Sekunden).

- [ ] **Step 1: Bake-Shader** – `SURFACE_SHADER` rendert statt des Bildschirms eine equirektanguläre Textur: `uv` → Länge `(u − 0.5)·2π`, Breite `(v − 0.5)·π` → Richtung `n`; bestehende Normalen-/Kraterberechnung unverändert; Ausgabe `vec4(N * 0.5 + 0.5, shade)` mit `shade = mix(0.7, 1.0, cavity) * (0.85 + 0.3 * tone) / 1.15` (in 0..1; beim Lesen ×1.15). Normale `N` in Objektkoordinaten. Kantenglättung/`uPixel` entfällt hier.
- [ ] **Step 2: Texturgröße** – Breite = kleinste Zweierpotenz ≥ 2.5 × Planetendurchmesser in Pixeln (`size / EXTENT`), min 512, max 2048; Höhe = Breite / 2. `TEXTURE_WRAP_S = REPEAT`, `WRAP_T = CLAMP_TO_EDGE`, `LINEAR`. Neu backen nur, wenn sich diese Texturgröße ändert; Canvas-Resize allein ändert nur `canvas.width/height` und Viewport. `newSize <= 0` weiterhin ignorieren.
- [ ] **Step 3: Frame-Shader** – Für `r < 1`: `n = (p, sqrt(1 − r²))`, um y mit `−uAngle` drehen → Objektrichtung → `u = atan(x, z) / 2π + 0.5`, `v = asin(y) / π + 0.5` → Textur lesen; Normale `N` mit `+uAngle` zurück in Bildschirmkoordinaten drehen; Licht, Farben, Unterseiten-Abdunklung, Atmosphäre und Kantenglättung (`1 − smoothstep(1 − uPixel, 1, r)`) wie bisher im alten `SURFACE_SHADER`. Flammen vorerst unverändert (2D) darüber.
- [ ] **Step 4: `PlanetCanvas.vue`** – Schleife läuft immer (auch bei `reducedMotion`), solange sichtbar. `angle = ((elapsed % ROTATION_PERIOD) / ROTATION_PERIOD) * 2π`, getrennt vom bestehenden `TIME_WRAP_SECONDS`. `reducedMotion` an `createPlanetRenderer` übergeben.
- [ ] **Step 5:** Browser (5180, Desktop + DevTools-Handy 390 px): Planet dreht sich gleichmäßig nach rechts, keine sichtbare Naht bei u = 0/1, Pole ohne Artefakte, Krater sehen aus wie vorher, Licht bleibt oben links. Performance-Tab: Frame-Zeit bei 4× CPU-Drosselung < 16 ms. `npm run type-check && npm run lint`.
- [ ] **Step 6:** Commit `feat(web): Planet dreht sich als 3D-Kugel`

### Task 6: 3D-Flammen

**Files:**
- Modify: `src/components/Planet/planetRenderer.ts`

**Interfaces:**
- Consumes: Objektkoordinaten-Drehung aus Task 5.
- Produces: GLSL-Konstante `CAMP_DIR` (Objektrichtung des Camps: Breite 35°, Länge 0 → `vec3(0.0, sin(35°), cos(35°))`), wird in Task 7 als `CAMP_LATITUDE = 35` in `campMesh.ts` gespiegelt.

- [ ] **Step 1:** Flammenrauschen auf 3D-Richtungen umstellen: Für jeden Pixel die Richtung zur Kugel (`dir` auf der Silhouette bzw. `n` auf der Scheibe) in Objektkoordinaten drehen und als Rausch-Eingang nehmen (`q = vec3(objDir * 3.4) + Zeitverschiebung nach außen`), damit Flammen mitdrehen. Silhouette (r ≥ 1): Form, Farben, Halo, `up`-Gewichtung und `edgeFade` wie bisher. Scheibe (r < 1): dünnes Lodern additiv, Stärke `0.35 · smoothstep(0.35, 0.95, r)` (Mitte hinter der Schrift gedämpft), dort nur ein `fbm` ohne Warp.
- [ ] **Step 2:** Flammenfreie Zone: Faktor `smoothstep(cos(12°), cos(18°), dot(objDir, CAMP_DIR))` auf Scheibe und Silhouette.
- [ ] **Step 3:** `reducedMotion`: `uTime` = 0 (Flammen stehen still, drehen aber mit).
- [ ] **Step 4:** Browser: Flammen drehen sichtbar mit, Schrift bleibt gut lesbar, Flammen-Lücke an der Camp-Stelle; mit DevTools „prefers-reduced-motion: reduce“ kein Flackern. Frame-Zeit wie in Task 5.
- [ ] **Step 5:** Commit `feat(web): Flammen drehen als 3D-Hülle mit`

### Task 7: Zelt-Camp

**Files:**
- Create: `src/components/Planet/campMesh.ts`, `src/components/Planet/campMesh.test.ts`
- Modify: `src/components/Planet/planetRenderer.ts`

**Interfaces:**
- Produces: `export const CAMP_LATITUDE = 35`; `export function buildCampMesh(): Float32Array` – verschachtelt pro Vertex `[x, y, z, nx, ny, nz, r, g, b]` (9 Floats), Dreiecksliste, Objektkoordinaten (Planetenradius 1).

- [ ] **Step 1: Failing test** `campMesh.test.ts`:
  - Länge durch 27 teilbar (ganze Dreiecke).
  - Alle Eckpunkte: `0.98 ≤ |p| ≤ 1.1` und Winkelabstand zur Camp-Richtung (`[0, sin35°, cos35°]`) < 8° (Camp ≈ 1/8 Planetendurchmesser).
  - Alle Normalen haben Länge 1 (±1e-3).
  - Genau 4 verschiedene Farben (rot `[0.85,0.15,0.12]`, gelb `[0.95,0.8,0.15]`, blau `[0.15,0.35,0.85]`, weiß `[0.95,0.95,0.92]`).
- [ ] **Step 2:** `npx vitest run --project web src/components/Planet/campMesh.test.ts` → FAIL
- [ ] **Step 3:** Implementieren: lokales Tangentensystem am Camp-Mittelpunkt (`up` = Kugelnormale, `east`, `north`); 3 Kuppelzelte (Halbellipsoid, 8 Segmente × 3 Ringe, Radius 0.035, Höhe 0.032) und 1 Pavillon (4 dünne Stangen 0.004 × 0.04, flaches Pyramidendach Kante 0.06, Spitze 0.055 über Grund) im Tangentenraum verteilt; Grundfläche 0.005 unter der Oberfläche beginnen, damit nichts schwebt.
- [ ] **Step 4:** Test → PASS
- [ ] **Step 5: Camp-Programm** im Renderer: Vertex-Shader dreht um y mit `uAngle`, orthografisch `gl_Position = vec4(p.xy / uExtent, −p.z * 0.5, 1)`; Fragment verwirft, wenn `length(p.xy) < 1.0 && p.z < sqrt(1 − dot(p.xy, p.xy))` (hinter der Kugel); Licht = gleiches `light` wie Oberfläche (`0.35 + 0.75 · diffuse`), Ausgabe deckend. Pro Frame nach dem Planeten-Pass: `clear(DEPTH)`, `enable(DEPTH_TEST)`, zeichnen, `disable(DEPTH_TEST)`. Canvas-Kontext mit `depth: true`. Buffer/Programm in `dispose()` freigeben.
- [ ] **Step 6:** Browser: Camp zieht vorne über die Kuppe, läuft kurz hinter der Schrift durch, verschwindet sauber am Horizont (kein Durchscheinen auf der Rückseite), Zelte haben Licht/Schatten.
- [ ] **Step 7:** Commit `feat(web): kleines Zelt-Camp auf dem Planeten`

### Task 8: Wetter-Effekte in der Szene

**Files:**
- Modify: `src/components/Planet/planetRenderer.ts`, `src/components/Planet/PlanetCanvas.vue`

**Interfaces:**
- Consumes: `WeatherScene` (Task 3), `weather`-Prop (Task 4)
- Produces: `PlanetRenderer.setWeather(scene: WeatherScene | null): void` → Uniforms `uWeather` (0 klar, 1 bewölkt, 2 Nebel, 3 Regen, 4 Schnee, 5 Gewitter; `null` → 0) und `uIntensity`.

- [ ] **Step 1:** `setWeather` + Uniforms; `PlanetCanvas.vue` ruft es initial und per `watch(() => props.weather)` auf.
- [ ] **Step 2: Wolken** (bewölkt, Regen, Schnee, Gewitter): auf der Scheibe `fbm(objDirWolken · 2.5)` mit eigener Drehung `uAngle · 0.8`, weißlich-grün, Deckkraft bis `0.55 · uIntensity` (Regen/Gewitter etwas dunkler); leichter Saum knapp außerhalb der Silhouette.
- [ ] **Step 3: Nebel:** Farbe Richtung `vec3(0.75, 0.85, 0.8)` mischen (`0.35 · uIntensity`) plus weicher Dunst-Halo bis r ≈ 1.4.
- [ ] **Step 4: Regen/Schnee:** im Canvas innerhalb `r < uExtent` (mit `edgeFade`): Regen = schräge, schnell fallende Streifen aus gekachelten Zellen mit Zufallsversatz; Schnee = langsam fallende runde Flocken mit seitlichem Pendeln; Dichte proportional zu `uIntensity`. Vor dem Planeten gezeichnet. Bei `reducedMotion` aus.
- [ ] **Step 5: Gewitter:** wie Regen mit Intensität 1 + Blitz: `flash = step(0.94, hash(floor(uTime · 2)))`, schnell abklingend, hellt Wolken und Szene auf. Bei `reducedMotion` aus.
- [ ] **Step 6:** Browser mit `?weather=clear|cloudy|fog|rain|snow|storm` (Dev-Override aus Task 3) jeden Zustand prüfen; Schalter „Effekte“ aus → alles klar; Frame-Zeit bei Gewitter unter 4× Drosselung < 16 ms, sonst Tropfendichte senken.
- [ ] **Step 7:** Commit `feat(web): Wetter am Nürburgring verändert die Planeten-Szene`

### Task 9: Abschluss

- [ ] **Step 1:** `npm run type-check && npm run lint && npm test && npm run build-only` → alles grün (Ausgabe festhalten).
- [ ] **Step 2:** Browser 5180, Desktop + 390 px: alle Spec-Punkte durchgehen (Drehung, Camp, Flammen, Schrift lesbar, Station, Panel, Schalter, Reload offline – DevTools „Offline“ → Station zeigt gespeicherten Stand, Datenschutz-/Credits-Texte).
- [ ] **Step 3:** Ohne WebGL testen (Chrome `--disable-webgl` oder `getContext` in DevTools überschreiben): CSS-Fallback + Station funktionieren.
