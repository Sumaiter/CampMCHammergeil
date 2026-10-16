# 3D-Planet mit Camp und Nürburgring-Wetter – Design

## Ziel

- Der Header-Planet wird eine echte 3D-Kugel, die sich langsam um ihre eigene, **senkrechte** Achse dreht
  (keine Neigung, kein Taumeln). Das bisherige Auf-/Ab-Schweben (`float`-Animation) entfällt.
- Auf der Oberfläche steht ein kleines Festival-Camp (3 Kuppelzelte + 1 Pavillon), das mit dem Planeten
  mitdreht, vorne über die Kuppe zieht, kurz hinter dem Schriftzug durchläuft und hinten verschwindet.
- Die grünen Flammen werden Teil der 3D-Szene: sie hängen an der Oberfläche und drehen mit.
- Der Schriftzug „Camp MC Hammergeil“ schwebt unverändert (Glitch, Link zur Startseite) davor.
- Das aktuelle Wetter am Nürburgring ist immer sichtbar (Wetterstation oben links) und verändert die Szene
  (Wolken, Regen, Schnee, Gewitter, Nebel). Die Szene-Effekte lassen sich per immer sichtbarem Schalter abschalten.

## Rahmenbedingungen

- Wird am Handy während Rock am Ring mit schlechtem Netz genutzt (~10 Nutzer): **wenig Daten, flüssig am Handy**.
- Keine neue Bibliothek (kein Three.js), keine Bilder/Modelle zum Nachladen – alles im bestehenden WebGL-Renderer.
- Der Planet dreht sich **immer** langsam (ca. 1 Umdrehung pro Minute), auch bei `prefers-reduced-motion`.
  Pausiert wird nur, solange er aus dem Bild gescrollt ist. Bei `prefers-reduced-motion` entfallen
  Flammen-Flackern, Tropfen/Flocken und Blitze (Flammen stehen still, drehen aber mit).
- Ohne WebGL bleibt der bisherige CSS-Farbverlauf als Fallback; die Wetterstation funktioniert trotzdem.
- Dev-Server läuft auf Port 5180.

## Planet-Renderer (`src/components/Planet/planetRenderer.ts`)

Weiterhin reines WebGL 1, Vollbild-Dreieck, ein Canvas (`EXTENT`-mal so groß wie der Planet).

### Oberfläche einmal backen

- Die teure Kraterlandschaft (`surfaceHeight`, unverändert inkl. Überlappungsregeln) wird **einmalig** in eine
  equirektanguläre Textur gerendert (Breite = 2 × Höhe, z. B. 1024 × 512, an Pixeldichte gekoppelt, max. 2048 × 1024).
  Kanäle: RGB = fertige Oberflächen-Normale (Objektkoordinaten), A = Helligkeitsfaktor aus Höhlen und Ton –
  so bleibt lineare Texturfilterung korrekt und pro Frame genügt ein Texturzugriff.
- Neu gebacken wird nur, wenn sich die Texturgröße ändert – nicht bei jedem Resize um ein paar Pixel.

### Pro Frame

- Für jeden Pixel innerhalb der Kugel: Normale `n` aus der Bildschirmposition, um die y-Achse um
  `angle = time * ROTATION_SPEED` zurückgedreht → Länge/Breite → Textur lesen.
- Oberflächen-Normale direkt aus der Textur (mit dem Planeten mitgedreht) statt drei `surfaceHeight`-Aufrufen.
- Licht bleibt fest (oben links, wie heute), Farbgebung/Atmosphäre/Unterseiten-Abdunklung wie bisher.
- `ROTATION_SPEED`: eine Umdrehung ca. alle 60 s.

### 3D-Flammen

- Flammen als Rauschen in einer Hülle um die Kugel, im **mitdrehenden** Koordinatensystem berechnet
  (3D-Richtung statt 2D-Winkel), Zeit lässt sie nach außen züngeln.
- Silhouette: ragen wie heute über den Rand. Vorderseite: dünnes Lodern über der Fläche, zur Bildmitte hin
  (hinter dem Schriftzug) gedämpft, damit die Schrift lesbar bleibt.
- Um das Camp herum (Winkelabstand < ca. 12°) keine Flammen.

### Camp

- Liegt auf ca. 35° nördlicher Breite, gesamt ca. 1/8 des Planetendurchmessers.
- 3 Kuppelzelte (unterschiedliche Farben, z. B. rot, gelb, blau) + 1 weißer Pavillon (flaches Spitzdach auf vier Stangen).
- Umsetzung: kleine Dreiecksmodelle, deren Eckpunkte im Code stehen (wenige hundert Bytes), eigenes Shader-Programm
  mit derselben orthografischen Projektion wie die Kugel und derselben Rotation. Gezeichnet nach dem Planeten-Pass
  in denselben Canvas. Verdeckung durch den Planeten: Fragment wird verworfen, wenn es hinter der Kugeloberfläche liegt
  (`|p.xy| < 1` und `p.z < sqrt(1 − |p.xy|²)`); Tiefenpuffer für die Modelle untereinander.
- Beleuchtung mit demselben Licht wie die Oberfläche.

### Wetter-Effekte (im Flammen-/Frame-Shader, Uniforms)

`uWeather`: Zustand (0 klar, 1 bewölkt, 2 Nebel, 3 Regen, 4 Schnee, 5 Gewitter), `uIntensity` (0..1), `uEffects` (0/1).

| Zustand | Effekt |
|---|---|
| klar | nichts zusätzlich |
| bewölkt | halbtransparente Wolkenschleier in einer Hülle knapp über der Oberfläche, drehen etwas langsamer als der Planet |
| Nebel | milchiger Dunst über Planet und Rand |
| Regen | Wolken + schräg fallende Tropfenstreifen im Canvas rund um den Planeten (Dichte nach Intensität) |
| Schnee | Wolken + langsam fallende, leicht pendelnde Flocken |
| Gewitter | wie starker Regen + gelegentliches Blitz-Aufhellen (alle paar Sekunden zufällig) |

Bei `uEffects = 0` oder ohne Wetterdaten: Zustand „klar“. Bei `prefers-reduced-motion`: Wolken/Nebel drehen nur mit dem Planeten mit, keine Tropfen/Flocken/Blitze.

### Schnittstelle

```ts
export interface PlanetRenderer {
  resize(size: number): void
  render(time: number): void
  setWeather(scene: WeatherScene | null): void // null = keine Effekte
  dispose(): void
}
```

`PlanetCanvas.vue` reicht die Wetterszene als Prop durch (aus `useWeather`, unter Berücksichtigung des Schalters).

## Wetter

### Worker-Route `GET /api/weather` (`worker/routes/weather.ts`)

- Kein Login nötig.
- Upstream: `https://api.open-meteo.com/v1/forecast?latitude=50.3356&longitude=6.9475`
  `&current=temperature_2m,weather_code,is_day,wind_speed_10m`
  `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max`
  `&timezone=Europe%2FBerlin&forecast_days=4`
- Antwort (camelCase, Typen in `src/api/types.ts`), ca. 1 KB:

```ts
type WeatherCondition = 'clear' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm'

interface WeatherScene { condition: WeatherCondition; intensity: number } // 0..1

interface Weather {
  current: { temperature: number; condition: WeatherCondition; intensity: number; isDay: boolean; windKmh: number }
  daily: { date: string; condition: WeatherCondition; max: number; min: number; rainChance: number | null }[] // heute + 3 Tage
  updatedAt: string // ISO, Zeitpunkt der Upstream-Abfrage
}
```

- Caching: Ergebnis 15 min im Cloudflare-Cache (`caches.default`, Schlüssel = feste URL);
  Antwort-Header `Cache-Control: public, max-age=300`.
- Upstream-Fehler/Timeout (5 s) oder unerwartetes Format → 502 `{ error: 'Wetter nicht verfügbar' }`.

### WMO-Code → Zustand (`worker/lib/weatherCode.ts`, reine Funktion)

| WMO-Codes | Zustand | Intensität |
|---|---|---|
| 0, 1 | clear | 0 |
| 2, 3 | cloudy | 2 → 0.5, 3 → 1 |
| 45, 48 | fog | 1 |
| 51–57 (Niesel), 61, 80 | rain | 0.3 |
| 63, 81 | rain | 0.6 |
| 65, 66, 67, 82 | rain | 1 |
| 71, 77, 85 | snow | 0.3 |
| 73 | snow | 0.6 |
| 75, 86 | snow | 1 |
| 95, 96, 99 | storm | 1 |
| unbekannt | cloudy | 0.5 |

### Browser (`src/weather/useWeather.ts`)

- Geteilter Zustand (wie `useAuth`): `weather`, `effectsEnabled`, `stale`.
- Beim Start: letzte Antwort aus `localStorage` (`weather:last`) sofort anzeigen, dann im Hintergrund `/api/weather` laden.
- Aktualisierung alle 15 min, nur solange der Tab sichtbar ist (`visibilitychange`); beim Zurückkehren sofort, falls älter als 15 min.
- Fehler: alter Stand bleibt, keine Fehlermeldung; ist der Stand älter als 1 h, zeigt die Station „Stand HH:MM“.
- Ganz ohne Daten: Station zeigt „–°“, keine Effekte.
- Schalter: `effectsEnabled` in `localStorage` (`weather:effects`, Standard an).

### Wetterstation (`src/components/Weather/WeatherStation.vue`)

- Oben links im Header, Gegenstück zum Login-Satelliten (gleiche Größe/Typografie): Wetter-Emoji (Tag/Nacht beachtet),
  Temperatur gerundet, darunter Label „NÜRBURGRING“.
- Tippen öffnet ein kleines Glass-Panel mit 3-Tage-Vorhersage (Wochentag, Emoji, max/min, Regenwahrscheinlichkeit);
  schließen per erneutem Tippen, Klick außerhalb oder Escape.
- Direkt unter der Station ein kleiner, immer sichtbarer Schalter „Effekte“ (`role="switch"`, `aria-checked`).
- Auf schmalen Handys darf Station + Schalter den Planeten nicht überdecken (Header-Padding prüfen).

## Datenschutz

- Besucher sprechen nur mit unserem Worker; der Worker fragt Open-Meteo ohne personenbezogene Daten ab.
- Kurzer Absatz in `DatenschutzPage.vue` (Wetterdaten von Open-Meteo über unseren Server) und Eintrag in der
  Cookie-Liste (`localStorage` für Wetter-Cache und Effekt-Schalter, technisch notwendig/vom Nutzer angefordert).
- Credits-Seite: „Wetterdaten: Open-Meteo.com (CC BY 4.0)“ (Lizenz verlangt Namensnennung).

## Tests

- `worker/lib/weatherCode.test.ts`: Tabelle oben.
- `worker/test/weather.test.ts`: Antwortformat, Cache-Treffer (zweite Anfrage ruft `fetch` nicht erneut auf),
  Upstream-Fehler → 502 (Upstream-`fetch` gemockt).
- `src/weather/useWeather.test.ts`: localStorage-Stand wird sofort genutzt, Fehler behält alten Stand, Schalter wird gespeichert.
- Grafik manuell im Browser (Port 5180), Desktop und Handy-Ansicht: Drehung flüssig, Camp verdeckt korrekt,
  Schrift lesbar, jeder Wetterzustand einmal per Dev-Override (`?weather=storm`, nur im Dev-Build) geprüft.
