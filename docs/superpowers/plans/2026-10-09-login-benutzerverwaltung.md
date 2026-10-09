# Login & Benutzerverwaltung (Cloudflare D1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Echte Benutzerkonten in Cloudflare D1. Ein Admin verwaltet Benutzer über die Webseite, Benutzer ändern ihr eigenes Passwort, und der Shop ist nur eingeloggt sichtbar. Die Seite zieht von Pages auf einen Worker mit Static Assets um.

**Architecture:** Ein Worker (`worker/index.ts`, Hono) beantwortet `/api/*` und greift auf D1 (`DB`) zu. Alle anderen Pfade liefert er als Vue-SPA aus (Static Assets). Das Vue-Frontend hält den Login-Zustand in einem Composable und schützt Routen mit einem globalen Guard.

**Tech Stack:** Vue 3.5, Vite 8, vue-router 5, Hono 4, Cloudflare Workers + D1 + Rate Limiting Binding, `@cloudflare/vite-plugin`, wrangler 4, Vitest 4.1 + `@cloudflare/vitest-plugin`.

**Spec:** `docs/superpowers/specs/2026-10-09-login-benutzerverwaltung-design.md`

## Global Constraints

- Alle UI-Texte und API-Fehlermeldungen auf Deutsch. Fehlerformat: `{ "error": "<Meldung>" }`.
- Login-Fehlermeldung immer genau: `Benutzername oder Passwort falsch`.
- Benutzername: getrimmt, 3–32 Zeichen, Regex `^[A-Za-z0-9._-]{3,32}$`, eindeutig ohne Beachtung der Groß-/Kleinschreibung.
- Passwort: 8–128 Zeichen.
- PBKDF2-SHA256, 100000 Iterationen, 16 Byte Salt, 32 Byte Ableitung. Format `pbkdf2$<iter>$<salt b64>$<hash b64>`.
- Session-Cookie: Name `session`, `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`. In der DB nur `SHA-256(token)` als hex.
- Rate Limit Login: Binding `LOGIN_LIMITER`, `limit: 10`, `period: 60`, Schlüssel `CF-Connecting-IP`.
- Schreibende Requests (`POST`, `DELETE`, `PUT`, `PATCH`) auf `/api/*` ohne `Content-Type: application/json` → `415`. `DELETE` ohne Body sendet der Client trotzdem mit diesem Header.
- D1-Datenbankname: `campmchammergeil`, Binding `DB`. Worker-Name: `campmchammergeil`.
- Vitest muss `^4.1.x` sein (Peer-Bedingung von `@cloudflare/vitest-plugin` gemeinsam mit Vite 8).
- Bestehende Konventionen: `RoutePath`-Enum für alle Pfade, `routerHelper.goTo/replace` für Navigation, Kommentare auf Deutsch, Stilklassen `page-section`, `page-title`, `glass-card`, CSS-Variablen aus `src/styles/main.scss`.
- Commits enden mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Groß-/Kleinschreibung beim Login:** `JOSH` loggt sich als `josh` ein, und der Server liefert den gespeicherten Namen zurück (Test in Task 4).
2. **Username mit Leerzeichen am Rand:** `"  josh "` wird beim Anlegen und beim Login getrimmt und nicht als ungültig abgelehnt (Tests in Task 4 und 5).
3. **Nicht-numerische oder unbekannte `:id`:** `DELETE /api/admin/users/abc` → `404` statt `500` (Test in Task 5).
4. **Kaputter JSON-Body / fehlende Felder:** Ein `POST` mit Content-Type JSON, aber ungültigem Body oder fehlendem Feld → `400` mit deutscher Meldung, kein `500` (Tests in Task 1 und 4).
5. **Offener Redirect nach Login:** `/login?redirect=//evil.com` oder `https://evil.com` führt auf `/` (Test in Task 7).

---

## Datei-Übersicht

| Datei | Verantwortung |
|---|---|
| `wrangler.jsonc` | Worker-Konfiguration (main, assets, D1, Rate Limit) |
| `migrations/0001_users_sessions.sql` | Schema |
| `worker/index.ts` | Hono-App, Content-Type-Prüfung, Fehler-/404-Handler, mountet Routen |
| `worker/types.ts` | `AppEnv`, `User` |
| `worker/lib/password.ts` | `hashPassword`, `verifyPassword` (keine Imports, auch in Node nutzbar) |
| `worker/lib/validation.ts` | `normalizeUsername`, `validateUsername`, `validatePassword`, `readJson` |
| `worker/lib/session.ts` | Session-Lebenszyklus in D1, Konstanten |
| `worker/middleware.ts` | `loadUser`, `requireUser`, `requireAdmin` |
| `worker/routes/auth.ts` | `/api/auth/*` |
| `worker/routes/admin.ts` | `/api/admin/*` |
| `worker/test/*` | Worker-Tests + Helfer + Migrations-Setup |
| `scripts/create-admin.ts`, `scripts/admin-sql.ts` | Ersten Admin anlegen |
| `src/api/client.ts` | fetch-Hülle, `ApiError` |
| `src/api/types.ts` | `User`, `AdminUser` (Frontend-Seite) |
| `src/auth/useAuth.ts` | Login-Zustand |
| `src/router/guard.ts` | Reine Guard-Logik + `safeRedirect` |
| `src/components/Account/AccountPage.vue` | `/konto` |
| `src/components/Admin/AdminUsersPage.vue` | `/admin` |
| `src/styles/main.scss` | gemeinsame Formular-Stile (`.form-field`, `.form-input`, `.btn`, `.form-error`, `.form-success`) |

---

### Task 1: Worker-Grundgerüst, D1-Schema und Testumgebung

**Files:**
- Modify: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `.gitignore`, `eslint.config.ts`
- Create: `wrangler.jsonc`, `migrations/0001_users_sessions.sql`, `tsconfig.worker.json`, `vitest.config.ts`, `worker/index.ts`, `worker/types.ts`, `worker/lib/validation.ts`, `worker/test/apply-migrations.ts`, `worker/test/env.d.ts`, `worker/test/helpers.ts`, `worker/test/app.test.ts`, `worker-configuration.d.ts` (generiert)

**Interfaces:**
- Produces:
  - `worker/types.ts`: `export type User = { id: number; username: string; isAdmin: boolean }` und `export type AppEnv = { Bindings: Env; Variables: { user: User | null; sessionId: string | null } }`.
  - `worker/index.ts`: `export const app: Hono<AppEnv>`, `export default app`. Später kommen dort `app.route('/api/auth', authRoutes)` und `app.route('/api/admin', adminRoutes)` dazu.
  - `worker/lib/validation.ts`: `export class HttpError extends Error { constructor(public status: 400|401|403|404|409|415|429, message: string) }` und `export async function readJson<T extends Record<string, unknown>>(c: Context): Promise<Partial<T>>`. Bei ungültigem JSON oder einem Body, der kein Objekt ist, wirft sie `HttpError(400, 'Ungültige Anfrage')`.
  - `worker/test/helpers.ts`: `api(path: string, init?: { method?: string; body?: unknown; cookie?: string; ip?: string; contentType?: string | null }): Promise<Response>`. Ruft `exports.default.fetch(new Request('https://example.com' + path, …))` auf. Hat `body` einen Wert, wird JSON gesendet. `ip` ist standardmäßig eine zufällige IP, damit das Rate Limit zwischen Tests nicht durchschlägt. Außerdem `resetDb(): Promise<void>` (löscht `sessions`, dann `users`).

- [ ] **Step 1: Abhängigkeiten installieren**

```bash
npm install hono
npm install -D wrangler @cloudflare/vite-plugin @cloudflare/vitest-plugin vitest@~4.1.11
```

Erwartet: Installation ohne Peer-Dependency-Fehler.

- [ ] **Step 2: Konfiguration anlegen**

`wrangler.jsonc`:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "campmchammergeil",
  "main": "worker/index.ts",
  "compatibility_date": "2026-10-01",
  "assets": {
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api/*"]
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "campmchammergeil",
      // Platzhalter – wird in Task 10 durch die echte ID aus `wrangler d1 create` ersetzt
      "database_id": "00000000-0000-0000-0000-000000000000",
      "migrations_dir": "migrations"
    }
  ],
  "ratelimits": [
    { "name": "LOGIN_LIMITER", "namespace_id": "1001", "simple": { "limit": 10, "period": 60 } }
  ],
  "observability": { "enabled": true }
}
```

`migrations/0001_users_sessions.sql`: Das Schema übernimmst du wörtlich aus der Spec, Abschnitt „Datenmodell“. Dazu gehört auch `CREATE INDEX sessions_user_id ON sessions(user_id);`.

`vite.config.ts`: `cloudflare()` aus `@cloudflare/vite-plugin` kommt in `plugins` nach `vue()` und `vueDevTools()`.

`tsconfig.worker.json`: erweitert `@tsconfig/node24` nicht. Eigene Einstellungen:
- `target`/`lib` `ES2023`, `module` `preserve`, `moduleResolution` `bundler`, `strict`, `noUncheckedIndexedAccess`, `noEmit`
- `types: ["@cloudflare/vitest-plugin/types"]`
- `include: ["worker/**/*", "worker-configuration.d.ts"]`
- `tsBuildInfoFile: "./node_modules/.tmp/tsconfig.worker.tsbuildinfo"`

Danach als Referenz in `tsconfig.json` eintragen. `tsconfig.node.json`: `scripts/**/*` in `include` aufnehmen und `"allowImportingTsExtensions": true` setzen.

`vitest.config.ts` mit zwei Projekten (`test.projects`, Inline-Configs):
- `worker`:
  - `plugins: [cloudflareTest(async () => ({ wrangler: { configPath: './wrangler.jsonc' }, miniflare: { bindings: { TEST_MIGRATIONS: await readD1Migrations('./migrations') } } }))]`
  - `test: { name: 'worker', include: ['worker/**/*.test.ts'], setupFiles: ['./worker/test/apply-migrations.ts'] }`
- `web`: `test: { name: 'web', environment: 'node', include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'] }` und `resolve.alias` `@` → `./src` (wie in `vite.config.ts`).

Liegt `readD1Migrations` nicht im Hauptexport, ist es aus `@cloudflare/vitest-plugin/config` zu importieren. Prüfe das in `node_modules/@cloudflare/vitest-plugin/package.json`.

`worker/test/apply-migrations.ts`: `import { applyD1Migrations } from 'cloudflare:test'` und `import { env } from 'cloudflare:workers'`, dann `await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)`.

`worker/test/env.d.ts`: `declare module 'cloudflare:workers' { interface ProvidedEnv extends Env { TEST_MIGRATIONS: D1Migration[] } }`

`package.json`-Skripte ergänzen:
- `"test": "vitest run"`
- `"cf-typegen": "wrangler types"`
- `"deploy": "npm run build && wrangler deploy"`
- `"db:migrate:local": "wrangler d1 migrations apply campmchammergeil --local"`
- `"db:migrate:remote": "wrangler d1 migrations apply campmchammergeil --remote"`

`.gitignore`: `.wrangler` und `.dev.vars*` ergänzen.

`eslint.config.ts`: `worker-configuration.d.ts` und `**/.wrangler/**` zu `globalIgnores`.

Danach `npm run cf-typegen` ausführen. Erwartet: `worker-configuration.d.ts` mit `interface Env { DB: D1Database; LOGIN_LIMITER: RateLimit }`. Die Datei wird committet.

- [ ] **Step 3: Failing Tests schreiben, `worker/test/app.test.ts`**

```ts
it('Unbekannte API-Route liefert 404 JSON', async () => {
  const res = await api('/api/gibtsnicht')
  expect(res.status).toBe(404)
  expect(await res.json()).toEqual({ error: 'Nicht gefunden' })
})
it('POST ohne JSON-Content-Type liefert 415', async () => {
  const res = await api('/api/auth/login', { method: 'POST', contentType: 'text/plain' })
  expect(res.status).toBe(415)
  expect(await res.json()).toEqual({ error: 'Content-Type muss application/json sein' })
})
it('Migration ist angewendet', async () => {
  const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE name = 'users'").first()
  expect(row).not.toBeNull()
})
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run --project worker`
Erwartet: FAIL, `worker/index.ts` fehlt bzw. die Routen gibt es nicht.

- [ ] **Step 5: `worker/index.ts`, `worker/types.ts`, `HttpError`/`readJson` in `worker/lib/validation.ts` implementieren**

- `app.use('/api/*', …)`: Bei schreibenden Methoden muss der `Content-Type`-Header mit `application/json` beginnen, sonst `415` mit der Meldung aus dem Test.
- `app.notFound` → `404 { error: 'Nicht gefunden' }`.
- `app.onError`: Bei `HttpError` kommt `{ error: message }` mit dessen Status. Bei allem anderen `console.error(err)` und `500 { error: 'Interner Fehler' }`.

- [ ] **Step 6: Tests laufen lassen**

Run: `npx vitest run --project worker`
Erwartet: 3 passed.

- [ ] **Step 7: Prüfen, dass die App weiterhin baut und startet**

Run: `npm run build`
Erwartet: Erfolg. Die Ausgabe enthält Client-Assets und das Worker-Bundle unter `dist/`.

Run: `npm run dev`, dann `curl -s http://localhost:5173/api/gibtsnicht`
Erwartet: `{"error":"Nicht gefunden"}`. `http://localhost:5173/shop` liefert HTML.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(worker): scaffold Cloudflare Worker with Hono, D1 schema and test setup"
```

---

### Task 2: Passwort-Hashing

**Files:**
- Create: `worker/lib/password.ts`, `worker/test/password.test.ts`

**Interfaces:**
- Produces: `hashPassword(password: string): Promise<string>`, `verifyPassword(password: string, stored: string): Promise<boolean>`. Die Datei hat **keine Imports**, nur `globalThis.crypto`, damit auch Node sie in `scripts/create-admin.ts` laden kann.

- [ ] **Step 1: Failing Tests**

```ts
it('erzeugt das pbkdf2-Format mit 100000 Iterationen', async () => {
  const h = await hashPassword('geheim123')
  expect(h).toMatch(/^pbkdf2\$100000\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/)
})
it('verifiziert richtiges und lehnt falsches Passwort ab', async () => {
  const h = await hashPassword('geheim123')
  expect(await verifyPassword('geheim123', h)).toBe(true)
  expect(await verifyPassword('geheim124', h)).toBe(false)
})
it('nutzt zufälligen Salt', async () => {
  expect(await hashPassword('geheim123')).not.toBe(await hashPassword('geheim123'))
})
it('liefert false bei kaputtem Hash statt zu werfen', async () => {
  expect(await verifyPassword('x', 'kaputt')).toBe(false)
})
```

- [ ] **Step 2: Run** `npx vitest run --project worker password` → FAIL (Modul fehlt)

- [ ] **Step 3: Implementieren.** `crypto.subtle.importKey('raw', …, 'PBKDF2', false, ['deriveBits'])` + `deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256)`. Die Iterationszahl beim Prüfen kommt aus dem gespeicherten String. Der Vergleich läuft in konstanter Zeit per XOR-Schleife über die Bytes, weil `crypto.subtle.timingSafeEqual` in Node fehlt. Base64 über `btoa`/`atob`.

- [ ] **Step 4: Run** `npx vitest run --project worker password` → 4 passed

- [ ] **Step 5: Commit** `feat(worker): add PBKDF2 password hashing`

---

### Task 3: Validierung und Sessions

**Files:**
- Modify: `worker/lib/validation.ts`
- Create: `worker/lib/session.ts`, `worker/test/session.test.ts`, `worker/test/validation.test.ts`

**Interfaces:**
- Consumes: `User` aus `worker/types.ts`.
- Produces (`validation.ts`):
  - `normalizeUsername(value: unknown): string`: trimmt, bei Nicht-String `''`.
  - `validateUsername(name: string): void`: wirft `HttpError(400, 'Benutzername muss 3–32 Zeichen lang sein und darf nur Buchstaben, Ziffern, . _ - enthalten')`.
  - `validatePassword(value: unknown): string`: wirft `HttpError(400, 'Passwort muss 8–128 Zeichen lang sein')` und gibt sonst das Passwort zurück.
- Produces (`session.ts`):
  - `SESSION_COOKIE = 'session'`, `SESSION_TTL_SECONDS = 2592000`
  - `hashToken(token: string): Promise<string>` (SHA-256 hex)
  - `createSession(db: D1Database, userId: number, now = Date.now()): Promise<{ token: string; sessionId: string }>`
  - `getSession(db: D1Database, token: string, now = Date.now()): Promise<{ sessionId: string; user: User } | null>`: Abgelaufene Sessions werden gelöscht, das Ergebnis ist dann `null`. `is_admin` wird auf `boolean` gemappt.
  - `deleteSession(db, sessionId: string): Promise<void>`
  - `deleteUserSessions(db, userId: number, exceptSessionId?: string): Promise<void>`

- [ ] **Step 1: Failing Tests**

`validation.test.ts`:
- `normalizeUsername('  josh ')` → `'josh'`, `normalizeUsername(5)` → `''`.
- `validateUsername` wirft bei `'ab'`, `'a'.repeat(33)`, `'jo sh'`, `'jösh'` und nicht bei `'Josh_1.-'`.
- `validatePassword` wirft bei `'1234567'`, `'x'.repeat(129)`, `undefined` und gibt `'12345678'` zurück.

`session.test.ts` (in `beforeEach` erst `resetDb()`, dann Benutzer direkt per SQL einfügen):
- `createSession` liefert ein Token mit ≥ 43 Zeichen. In `sessions` steht `hashToken(token)`, nicht das Token.
- `getSession(token)` → `{ user: { id, username: 'josh', isAdmin: false } }`.
- Mit `now` nach Ablauf (`Date.now() + 2592001000`) → `null`, und die Zeile ist gelöscht.
- `getSession('unbekannt')` → `null`.
- `deleteUserSessions(db, id, keep)` lässt nur `keep` übrig.

- [ ] **Step 2: Run** `npx vitest run --project worker session validation` → FAIL

- [ ] **Step 3: Implementieren.** Token: 32 Bytes von `crypto.getRandomValues`, base64url. `expires_at` in Sekunden.

- [ ] **Step 4: Run** → alle passed

- [ ] **Step 5: Commit** `feat(worker): add input validation and D1 session store`

---

### Task 4: Auth-Middleware und `/api/auth/*`

**Files:**
- Create: `worker/middleware.ts`, `worker/routes/auth.ts`, `worker/test/auth.test.ts`
- Modify: `worker/index.ts` (Middleware `loadUser` auf `/api/*`, `app.route('/api/auth', authRoutes)`), `worker/test/helpers.ts`

**Interfaces:**
- Consumes: Task 2 und Task 3 vollständig.
- Produces:
  - `middleware.ts`:
    - `loadUser: MiddlewareHandler<AppEnv>` liest das Cookie per `getCookie` aus `hono/cookie` und setzt `c.var.user` / `c.var.sessionId` (oder `null`).
    - `requireUser` wirft `HttpError(401, 'Nicht eingeloggt')`.
    - `requireAdmin` wirft 401 wie oben bzw. `HttpError(403, 'Keine Berechtigung')`.
  - `routes/auth.ts`: `export const authRoutes: Hono<AppEnv>`.
  - Zusätzlich in `helpers.ts`:
    - `createUser(username: string, password: string, isAdmin = false): Promise<number>` (direkt per SQL mit `hashPassword`)
    - `login(username: string, password: string): Promise<string>`: liefert den `Cookie`-Header-Wert `session=<token>`.

Endpunkt-Verhalten laut Spec-Tabelle. Hinweise:
- **Login:**
  - Zuerst `env.LOGIN_LIMITER.limit({ key: ip })`, bei `!success` → `429 'Zu viele Login-Versuche. Bitte warte eine Minute.'`.
  - Benutzer per `WHERE username = ?` laden (die Spalte ist `COLLATE NOCASE`).
  - Bei unbekanntem Benutzer trotzdem `verifyPassword` gegen einen einmalig erzeugten Dummy-Hash ausführen, damit die Antwortzeit gleich bleibt.
  - Fehlt `username` oder `password`, ist das ebenfalls `401` mit der Standardmeldung.
- **Cookie** per `setCookie(c, SESSION_COOKIE, token, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: SESSION_TTL_SECONDS })`.
- **`/password`:**
  - `currentPassword` falsch → `401 'Aktuelles Passwort ist falsch'`.
  - `newPassword` per `validatePassword`.
  - Nach dem Update `deleteUserSessions(db, user.id, c.var.sessionId)`.

- [ ] **Step 1: Failing Tests, `auth.test.ts`** (`beforeEach`: `resetDb()`, `createUser('josh', 'geheim123')`)

```ts
it('Login mit richtigen Daten setzt Cookie und liefert User', async () => {
  const res = await api('/api/auth/login', { method: 'POST', body: { username: 'josh', password: 'geheim123' } })
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ user: { id: expect.any(Number), username: 'josh', isAdmin: false } })
  const cookie = res.headers.get('set-cookie')!
  expect(cookie).toMatch(/^session=[^;]+;/)
  for (const attr of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/', 'Max-Age=2592000']) expect(cookie).toContain(attr)
})
it('Login ist case-insensitiv und trimmt', async () => {
  const res = await api('/api/auth/login', { method: 'POST', body: { username: '  JOSH ', password: 'geheim123' } })
  expect((await res.json()).user.username).toBe('josh')
})
it.each([
  [{ username: 'josh', password: 'falsch123' }],
  [{ username: 'niemand', password: 'geheim123' }],
  [{}],
])('Login-Fehler liefert immer dieselbe Meldung (%o)', async (body) => {
  const res = await api('/api/auth/login', { method: 'POST', body })
  expect(res.status).toBe(401)
  expect(await res.json()).toEqual({ error: 'Benutzername oder Passwort falsch' })
})
it('Kaputtes JSON liefert 400', async () => { /* Body-String '{', Content-Type JSON → 400 { error: 'Ungültige Anfrage' } */ })
it('11. Login-Versuch derselben IP liefert 429', async () => { /* 10× falsch mit ip '10.0.0.1' → 401, 11. → 429 */ })
it('me ohne Cookie → { user: null }, mit Cookie → user', async () => {})
it('me mit abgelaufener Session → { user: null }', async () => { /* expires_at per SQL in die Vergangenheit setzen */ })
it('logout löscht Session und Cookie', async () => { /* danach me → null; set-cookie enthält Max-Age=0 */ })
it('logout ohne Login → 401', async () => {})
it('Passwort ändern: falsches aktuelles → 401 mit Meldung', async () => {})
it('Passwort ändern: zu kurz → 400', async () => {})
it('Passwort ändern: andere Sessions weg, aktuelle bleibt, neues Passwort gilt', async () => {
  /* zwei Logins A und B; mit A ändern; me(A) → user, me(B) → null; Login mit neuem Passwort → 200 */
})
```

- [ ] **Step 2: Run** `npx vitest run --project worker auth` → FAIL

Falls der 429-Test nach der Implementierung fehlschlägt, weil Miniflare das Rate-Limit-Binding lokal nicht durchsetzt: Den Test **nicht** löschen. Stattdessen mit `vi.spyOn(env.LOGIN_LIMITER, 'limit').mockResolvedValue({ success: false })` prüfen, dass der Handler bei `success: false` den Status `429` liefert, und das im Commit vermerken.

- [ ] **Step 3: `middleware.ts` und `routes/auth.ts` implementieren, in `index.ts` einhängen**

- [ ] **Step 4: Run** `npx vitest run --project worker` → alle passed

- [ ] **Step 5: Commit** `feat(worker): add login, logout, me and password change endpoints`

---

### Task 5: `/api/admin/*`

**Files:**
- Create: `worker/routes/admin.ts`, `worker/test/admin.test.ts`
- Modify: `worker/index.ts` (`app.route('/api/admin', adminRoutes)`)

**Interfaces:**
- Consumes: `requireAdmin`, `validation.ts`, `session.ts`, `hashPassword`, Test-Helfer.
- Produces: `adminRoutes: Hono<AppEnv>`. Die Listenantwort ist `{ users: Array<{ id: number; username: string; isAdmin: boolean; createdAt: string }> }`, sortiert nach `username COLLATE NOCASE`.

Hinweise:
- `:id` wird mit `Number()` geparst. Ist das Ergebnis keine positive Ganzzahl → `404 'Benutzer nicht gefunden'`.
- Doppelter Name: Den UNIQUE-Fehler von D1 abfangen (`/UNIQUE/` in `err.message`) → `409 'Benutzername ist bereits vergeben'`.
- Löschen:
  - eigene ID → `403 'Du kannst dein eigenes Konto nicht löschen'`
  - letzter Admin (`SELECT COUNT(*) FROM users WHERE is_admin = 1` ist 1 und das Ziel ist Admin) → `403 'Der letzte Admin kann nicht gelöscht werden'`
- Zurücksetzen: `validatePassword`, Update, `deleteUserSessions(db, id)`.

- [ ] **Step 1: Failing Tests, `admin.test.ts`** (`beforeEach`: `resetDb()`, Admin `boss`/`geheim123` (isAdmin), Benutzer `josh`/`geheim123`, Cookies `adminCookie` und `userCookie`)

- `GET /api/admin/users` ohne Cookie → 401. Mit `userCookie` → 403 `{ error: 'Keine Berechtigung' }`.
- Die Liste enthält `boss` und `josh` mit `createdAt`. `JSON.stringify(body)` enthält nicht `password` und nicht `pbkdf2`.
- `POST /api/admin/users` `{ username: '  neu ', password: 'startpass1' }` → 201 `{ user: { username: 'neu', isAdmin: false } }`. Danach Login als `neu` → 200.
- Das Anlegen von `JOSH` → 409. Bei `'x'` → 400, bei Passwort `'kurz'` → 400.
- `DELETE /api/admin/users/<joshId>` → 200. Danach ist `josh` nicht mehr in der Liste, und `me` mit `userCookie` → `{ user: null }`.
- `DELETE /api/admin/users/<bossId>` → 403 (eigenes Konto).
- Admin löscht einen anderen Admin: `boss2` per `createUser(..., true)` anlegen, `boss` löscht `boss2` → 200.
- Die Letzter-Admin-Regel lässt sich über HTTP nicht erreichen, weil der Handelnde selbst Admin ist und es damit mindestens zwei Admins gibt. Sie wird in Step 3 als reine Funktion getestet.
- `DELETE /api/admin/users/abc` → 404, `DELETE /api/admin/users/9999` → 404.
- `POST /api/admin/users/<joshId>/password` `{ password: 'neuespass1' }` → 200. Danach `me(userCookie)` → null, Login mit `neuespass1` → 200, mit `geheim123` → 401.
- Zurücksetzen mit `'kurz'` → 400, unbekannte ID → 404.

- [ ] **Step 2: Run** `npx vitest run --project worker admin` → FAIL

- [ ] **Step 3: Implementieren.** Die Löschregel gehört in eine exportierte reine Funktion `assertDeletable(target: { id: number; isAdmin: boolean }, actorId: number, adminCount: number): void` in `routes/admin.ts`. Sie wirft die beiden 403-Fehler. Zusätzlich Unit-Tests in `admin.test.ts`:
  - `assertDeletable({ id: 2, isAdmin: true }, 1, 1)` wirft `'Der letzte Admin kann nicht gelöscht werden'`
  - `assertDeletable({ id: 1, isAdmin: true }, 1, 2)` wirft `'Du kannst dein eigenes Konto nicht löschen'`
  - `assertDeletable({ id: 2, isAdmin: true }, 1, 2)` wirft nicht

  (Im echten System ist „letzter Admin, aber nicht man selbst“ nur bei inkonsistenten Daten erreichbar. Die Regel bleibt trotzdem als Absicherung.)

- [ ] **Step 4: Run** `npx vitest run --project worker` → alle passed

- [ ] **Step 5: Commit** `feat(worker): add admin user management endpoints`

---

### Task 6: Skript für den ersten Admin

**Files:**
- Create: `scripts/admin-sql.ts`, `scripts/admin-sql.test.ts`, `scripts/create-admin.ts`
- Modify: `package.json` (`"create-admin": "node scripts/create-admin.ts"`)

**Interfaces:**
- Consumes: `hashPassword` via `import { hashPassword } from '../worker/lib/password.ts'` (mit `.ts`-Endung, Node-Type-Stripping).
- Produces: `buildInsertAdminSql(username: string, passwordHash: string): string` in `scripts/admin-sql.ts`. Sie validiert den Namen mit derselben Regex wie die Spec (bei Fehler `throw new Error(...)`), verdoppelt `'` in beiden Werten und liefert `INSERT INTO users (username, password_hash, is_admin) VALUES ('<name>', '<hash>', 1);`

- [ ] **Step 1: Failing Test** (`scripts/admin-sql.test.ts`, Projekt `web`):
  - Ergebnis für `('boss', 'pbkdf2$1$a$b')` ist exakt `INSERT INTO users (username, password_hash, is_admin) VALUES ('boss', 'pbkdf2$1$a$b', 1);`
  - `('bo ss', 'x')` wirft.

- [ ] **Step 2: Run** `npx vitest run --project web` → FAIL

- [ ] **Step 3: Implementieren**
  - `admin-sql.ts` wie in der Interface-Beschreibung.
  - `create-admin.ts`:
    - Liest `<username>` und optional `--remote` aus `process.argv`. Ohne Namen wird die Nutzung ausgegeben und mit Exit-Code 1 beendet.
    - Fragt das Passwort zweimal verdeckt ab. Dafür `node:readline` mit stummgeschalteter Ausgabe (`_writeToOutput` überschreiben).
    - Prüft Übereinstimmung und 8–128 Zeichen.
    - Hasht das Passwort und schreibt das SQL in eine Temp-Datei (`os.tmpdir()`).
    - Führt `npx wrangler d1 execute campmchammergeil --local|--remote --file <tmp>` per `spawnSync` mit `stdio: 'inherit'` und `shell: true` aus (für Windows nötig).
    - Löscht die Temp-Datei in `finally` und gibt den Exit-Code weiter.

- [ ] **Step 4: Run** `npx vitest run --project web` → passed. Danach von Hand:
  - `npm run db:migrate:local`
  - `npm run create-admin -- boss` (Passwort eingeben)
  - `npx wrangler d1 execute campmchammergeil --local --command "SELECT username, is_admin FROM users"`

  Erwartet: `boss | 1`.

- [ ] **Step 5: Commit** `feat: add create-admin script`

---

### Task 7: Frontend – API-Client, `useAuth`, Router-Guard

**Files:**
- Create: `src/api/types.ts`, `src/api/client.ts`, `src/auth/useAuth.ts`, `src/auth/useAuth.test.ts`, `src/router/guard.ts`, `src/router/guard.test.ts`
- Modify: `src/router/routePath.ts`, `src/router/index.ts`

**Interfaces:**
- Produces:
  - `src/api/types.ts`: `User = { id: number; username: string; isAdmin: boolean }` und `AdminUser = User & { createdAt: string }`.
  - `src/api/client.ts`:
    - `class ApiError extends Error { status: number }`
    - `api.get<T>(path)`, `api.post<T>(path, body?)`, `api.delete<T>(path)`, alle → `Promise<T>`.
    - Sendet immer `Content-Type: application/json` und `credentials: 'same-origin'`.
    - Bei `!res.ok` wird `ApiError(status, body.error ?? 'Unbekannter Fehler')` geworfen. Vorher, bei `401`, wird der registrierte Handler aufgerufen.
    - `onUnauthorized(handler: () => void): void`
  - `src/auth/useAuth.ts`:
    - `useAuth(): { user: Readonly<Ref<User | null>>; isAdmin: ComputedRef<boolean>; ensureLoaded(): Promise<void>; login(username: string, password: string): Promise<void>; logout(): Promise<void> }`
    - Der Zustand liegt auf Modulebene. `ensureLoaded` teilt sich ein Promise und setzt es bei Fehlern zurück. Ein Fehler beim Laden ergibt `user = null`.
    - Registriert `onUnauthorized(() => user.value = null)`.
  - `src/router/guard.ts`:
    - `declare module 'vue-router' { interface RouteMeta { requiresAuth?: boolean; requiresAdmin?: boolean } }`
    - `resolveNavigation(to: { path: string; fullPath: string; meta: RouteMeta }, user: User | null): string | true`
    - `safeRedirect(value: unknown): string`: Nur Strings, die mit `/` und nicht mit `//` beginnen und kein `\` enthalten, kommen durch, sonst `'/'`.
  - `RoutePath.Account = '/konto'`, `RoutePath.Admin = '/admin'`.

- [ ] **Step 1: Failing Tests**

`guard.test.ts` (`fullPath` = `path`, außer wo angegeben):
- Öffentlich, ohne User → `true`.
- `requiresAuth` ohne User, `fullPath '/shop?x=1'` → `'/login?redirect=%2Fshop%3Fx%3D1'`.
- `requiresAuth` mit User → `true`.
- `requiresAdmin` ohne User → `'/login?redirect=%2Fadmin'`.
- `requiresAdmin` mit Nicht-Admin → `'/'`. Mit Admin → `true`.
- `path '/login'` mit User → `'/konto'`. Ohne User → `true`.
- `safeRedirect`: `'/shop'` → `'/shop'`. `'//evil.com'`, `'https://evil.com'`, `'/\\evil.com'`, `undefined`, `['/shop']` → `'/'`.

`useAuth.test.ts` (`fetch` per `vi.stubGlobal`, pro Test `vi.resetModules()` und `await import('./useAuth')`):
- Zwei parallele `ensureLoaded()` lösen genau 1 Fetch auf `/api/auth/me` aus. `user` danach = gelieferter User.
- `ensureLoaded` bei Netzwerkfehler → `user` null, ein erneuter Aufruf versucht es noch einmal.
- `login` sendet `POST /api/auth/login` mit JSON-Body und setzt `user`. Bei 401 wirft es einen `ApiError` mit der Server-Meldung, `user` bleibt null.
- `logout` sendet `POST /api/auth/logout` und setzt `user` auf null.
- Irgendein `api.get` mit 401 → `user` null.

- [ ] **Step 2: Run** `npx vitest run --project web` → FAIL

- [ ] **Step 3: Implementieren**
  - `client.ts`, `useAuth.ts` und `guard.ts` wie beschrieben.
  - In `router/index.ts`:
    - `meta: { requiresAuth: true }` an Shop, Shopping, ShoppingList, ShoppingOverview und den neuen Account-Eintrag (lazy `AccountPage.vue`).
    - `meta: { requiresAdmin: true }` am Admin-Eintrag (lazy `AdminUsersPage.vue`).
    - `router.beforeEach(async (to) => { await useAuth().ensureLoaded(); return resolveNavigation(to, useAuth().user.value) })`.
  - Für die beiden neuen Komponenten reichen in diesem Task Platzhalter mit `page-section` und `page-title`. Sie werden in Task 8 und 9 ausgebaut.

- [ ] **Step 4: Run** `npx vitest run --project web` → passed. `npm run type-check` → ohne Fehler.

- [ ] **Step 5: Commit** `feat(web): add API client, auth state and route guard`

---

### Task 8: Login-Seite, Konto-Seite, Header und Camp-Karte

**Files:**
- Modify: `src/styles/main.scss`, `src/components/Login/LoginView.vue`, `src/components/SiteHeader.vue`, `src/components/CampMap.vue:210-217`
- Modify: `src/components/Account/AccountPage.vue` (Platzhalter aus Task 7)

**Interfaces:**
- Consumes: `useAuth`, `api`, `ApiError`, `safeRedirect`, `routerHelper`, `RoutePath`.
- Produces: globale Klassen in `main.scss`. Sie werden aus den scoped Stilen von `LoginView.vue` herausgelöst, gleiches Aussehen:
  - `.form-field`: Label-Wrapper, der `span` ist das Label.
  - `.form-input`: der bisherige `input`-Stil.
  - `.btn`: der bisherige Gradient-Button. `.btn-secondary` ist die dezente Variante mit transparentem Hintergrund, `var(--c-border-strong)`-Rand und Text in `var(--c-accent)`.
  - `.form-error`: rot (`#ff8a8a`) und klein.
  - `.form-success`: `var(--c-accent)`.
  - Buttons mit `disabled` erhalten `opacity: .6; cursor: not-allowed`.

Verhalten (Spec, Abschnitt „Komponenten“):
- **LoginView:**
  - `login()` im `try`. `ApiError.message` landet in `.form-error` mit `role="alert"`.
  - Während der Anfrage ist der Button deaktiviert und zeigt `Einloggen…`.
  - Nach Erfolg `router.replace(safeRedirect(route.query.redirect))`. `routerHelper.replace` erwartet `RoutePath`, darum hier direkt `useRouter().replace`.
  - Das Formular bleibt ein natives `<form>`.
- **AccountPage:**
  - Titel `Hallo, {{ user.username }}`.
  - Card „Passwort ändern“ mit Feldern `Aktuelles Passwort`, `Neues Passwort`, `Neues Passwort wiederholen` (`autocomplete` `current-password`/`new-password`).
  - Stimmen die Felder nicht überein, kommt clientseitig `Die neuen Passwörter stimmen nicht überein`.
  - Erfolg: `Passwort geändert.` und die Felder werden geleert.
  - Button `Logout` (`.btn-secondary`): `logout()` → `routerHelper.replace(RoutePath.Home)`.
  - Für Admins `router-link` `Benutzerverwaltung` → `RoutePath.Admin`.
- **SiteHeader:** Das `router-link` des Satelliten bekommt `:to="user ? RoutePath.Account : RoutePath.Login"`. Das Label zeigt `user ? user.username : 'Login'`, `aria-label` entsprechend `Konto` oder `Login`. Lange Namen werden per CSS gekürzt (`max-width: 9ch; overflow: hidden; text-overflow: ellipsis`).
- **CampMap:** `v-if="user"` am `.shop-link`.

- [ ] **Step 1: Umsetzen** wie beschrieben. Das ist reine Präsentation, die Logik ist in Task 7 getestet.

- [ ] **Step 2: Prüfen**
  - Run: `npm run type-check` und `npm run lint` → ohne Fehler.
  - Run: `npm run dev` mit dem lokalen Admin aus Task 6. Im Browser (Desktop und 375 px Breite) prüfen:
    1. Ausgeloggt kein Shop-Link auf der Karte. `/shop` → `/login?redirect=%2Fshop`.
    2. Falsches Passwort → Meldung `Benutzername oder Passwort falsch`.
    3. Richtiges Passwort → zurück auf `/shop`. Der Satellit zeigt den Namen, die Karte den Shop-Link.
    4. `/konto`: Passwort ändern (falsches aktuelles → Meldung, abweichende Wiederholung → Meldung, Erfolg → `Passwort geändert.`).
    5. Logout → Startseite, Shop-Link weg.

- [ ] **Step 3: Commit** `feat(web): wire up login, account page, header and camp map to auth`

---

### Task 9: Admin-Seite

**Files:**
- Modify: `src/components/Admin/AdminUsersPage.vue` (Platzhalter aus Task 7)

**Interfaces:**
- Consumes: `api`, `ApiError`, `AdminUser`, `useAuth`, globale Formular-Klassen aus Task 8.

Verhalten (Spec, „AdminUsersPage“):
- Beim Laden `api.get<{ users: AdminUser[] }>('/api/admin/users')`.
- **Card „Benutzer anlegen“:** Felder `Benutzername` und `Startpasswort`. Bei Erfolg die Meldung `Benutzer „<name>“ angelegt.`, Felder leeren, Liste neu laden. Fehler in `.form-error`.
- **Card „Benutzer“:** Liste der Zeilen mit Name, Admin-Badge `Admin`, `Erstellt am` (formatiert mit `Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' })`; `createdAt` ist UTC `YYYY-MM-DD HH:MM:SS`, dafür vor dem Parsen `' '` → `'T'` ersetzen und `'Z'` anhängen).
- Pro Zeile Button `Passwort zurücksetzen`. Er öffnet in der Zeile ein Passwortfeld mit `Speichern` und `Abbrechen`. Bei Erfolg kommt `Passwort für „<name>“ zurückgesetzt.`
- Pro Zeile Button `Löschen` (nicht für `user.id === eigene id`). `confirm('Benutzer „<name>“ wirklich löschen?')` → `api.delete`, Liste neu laden.
- Meldungen pro Aktion. Es ist immer nur ein Reset-Feld gleichzeitig offen.
- Mobil (≤ 600 px) werden die Zeilen-Buttons umgebrochen und stehen unter dem Namen.

- [ ] **Step 1: Umsetzen**

- [ ] **Step 2: Prüfen**
  - Run: `npm run type-check` und `npm run lint` → ohne Fehler.
  - `npm run dev` als Admin:
    - Benutzer `testuser` anlegen. `TESTUSER` erneut anlegen → `Benutzername ist bereits vergeben`.
    - Passwort von `testuser` zurücksetzen und in einem privaten Fenster mit dem neuen Passwort einloggen.
    - `testuser` löschen. Das private Fenster ist beim nächsten Seitenwechsel ausgeloggt.
    - Für das eigene Konto gibt es keinen Löschen-Button.
    - Als Nicht-Admin führt `/admin` auf `/`.
    - Mobil 375 px prüfen.

- [ ] **Step 3: Commit** `feat(web): add admin user management page`

---

### Task 10: Datenschutz, Cookie-Hinweis, Abschlussprüfung und Umzug auf Cloudflare

**Files:**
- Modify: `src/components/Footer/DatenschutzPage.vue`, `src/components/CookieConsent/CookieConsent.vue:26-30`, `wrangler.jsonc` (`database_id`), `README.md`

- [ ] **Step 1: Datenschutz und Cookie-Hinweis**
  - **DatenschutzPage:** Nach „4. Zugriffsdaten (Server-Logfiles)“ einen neuen Abschnitt `<h2>5. Benutzerkonten</h2>` einfügen, im gleichen Markup-Stil wie die Nachbarabschnitte, mit den Inhalten aus der Spec, Abschnitt „Datenschutz & Cookies“. Die folgenden Abschnitte werden zu 6–11 umnummeriert. Abschnitt „Cookies“ (neu 7) bekommt einen Satz zum Session-Cookie (`session`, technisch notwendig, nur nach Anmeldung, 30 Tage bzw. bis Logout).
  - **CookieConsent:** `<li>Login-Session-Cookie (nur nach Anmeldung)</li>` unter „Essentiell“ ergänzen.
  - **README:** Einen kurzen Abschnitt „Backend (Cloudflare Worker + D1)“ ergänzen, mit `npm run dev`, `npm test`, `npm run db:migrate:local`, `npm run create-admin -- <name> [--remote]` und `npm run deploy`.

- [ ] **Step 2: Abschlussprüfung**
  - Run: `npm test`, `npm run lint`, `npm run build`
  - Erwartet: alle Tests grün, keine Lint-Fehler, Build erfolgreich.

- [ ] **Step 3: Commit** `docs: update privacy policy, cookie notice and README for user accounts`

- [ ] **Step 4: Cloudflare-Einrichtung, Schritte durch den Betreiber.** Diese Schritte brauchen den Cloudflare-Account des Benutzers. Der ausführende Agent gibt sie einzeln aus und wartet auf die Rückmeldung.
  1. `npx wrangler login`. Der Benutzer meldet sich im Browser an.
  2. `npx wrangler d1 create campmchammergeil`. Die ausgegebene `database_id` trägt der Agent in `wrangler.jsonc` ein. Commit: `chore: set production D1 database id`.
  3. `npm run db:migrate:remote`.
  4. `npm run create-admin -- <name> --remote`. Der Benutzer gibt das Passwort selbst ein.
  5. Den Branch pushen bzw. mergen (nach Rückfrage). Im Dashboard: **Workers & Pages → Create → Import a repository**, dieses Repo, Build-Befehl `npm run build`, Deploy-Befehl `npx wrangler deploy`, Production-Branch `main`.
  6. Auf der `*.workers.dev`-URL das Erfolgskriterium der Spec prüfen.
  7. Die eigene Domain im Pages-Projekt entfernen und unter Worker → Settings → Domains & Routes hinzufügen. Erneut prüfen. Das Pages-Projekt danach pausieren oder löschen.
