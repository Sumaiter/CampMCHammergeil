# Login & Benutzerverwaltung mit Cloudflare D1 – Design

Datum: 2026-10-09 · Status: abgestimmt, wartet auf Review der Spec

## Ziel

Camp MC Hammergeil bekommt echte Benutzerkonten, gespeichert in einer Cloudflare-D1-Datenbank.
Ein Admin legt Benutzer über die Webseite an, löscht sie und setzt Passwörter zurück.
Eingeloggte Benutzer können ihr eigenes Passwort ändern. Der Shop-Bereich ist nur für
eingeloggte Benutzer sichtbar und erreichbar.

**Erfolgskriterium:** Der Admin loggt sich auf der Live-Seite ein, legt einen Benutzer an.
Dieser Benutzer sieht nach dem Login das Shop-Symbol auf der Camp-Karte. Ausgeloggt ist es weg,
und `/shop` leitet auf `/login` um.

### Vorgaben

- Erster Anwendungsfall der Datenbank ist Login/Benutzer. Die Einkaufsliste folgt später als
  eigenes Teilprojekt auf derselben Datenbank.
- Konten entstehen nur durch den Admin über die Webseite. Es gibt keine öffentliche Registrierung.
- Admin-Funktionen: anlegen, löschen, Passwort zurücksetzen.
- Benutzer können ihr eigenes Passwort ändern.
- Ohne Login ist das Shop-Symbol auf der Camp-Karte ausgeblendet.
- Hosting bleibt bei Cloudflare. Die Seite zieht von Pages auf Workers (Static Assets) um.

### Nicht im Umfang

Einkaufsliste, Ernennen weiterer Admins über die Oberfläche, „Passwort vergessen“ per E-Mail,
Zwei-Faktor-Login.

## Architektur

Ein einziger Cloudflare Worker übernimmt beides:

- Anfragen an `/api/*` beantwortet der Worker-Code (Hono-Router) und greift dabei auf D1 zu
  (Binding `DB`).
- Alle anderen Anfragen gehen an die gebaute Vue-App (Static Assets) mit
  `not_found_handling: "single-page-application"`, damit Deep-Links wie `/shop` funktionieren.
- In `wrangler.jsonc` steht `assets.run_worker_first: ["/api/*"]`.

Lokale Entwicklung: `@cloudflare/vite-plugin` in `vite.config.ts`. `npm run dev` startet
Vue-App, Worker-API und eine lokale D1 gemeinsam.

### Dateien

```
wrangler.jsonc              Worker-Konfiguration: main, assets, D1-Binding DB, Rate-Limit-Binding
vite.config.ts              + cloudflare()-Plugin
migrations/
  0001_users_sessions.sql   Schema
worker/
  index.ts                  Hono-App, Mounting der Routen, zentrale Fehlerbehandlung
  routes/auth.ts            login, logout, me, eigenes Passwort ändern
  routes/admin.ts           Benutzer auflisten/anlegen/löschen/Passwort zurücksetzen
  lib/password.ts           hashPassword / verifyPassword (PBKDF2-SHA256, Web Crypto)
  lib/session.ts            Sessions anlegen/nachschlagen/löschen, Cookie-Helfer
  lib/validation.ts         Prüfung von Benutzername und Passwort
  middleware.ts             requireUser / requireAdmin
scripts/create-admin.ts     Legt einen Admin an (lokal oder --remote)
tsconfig.worker.json        TS-Konfiguration mit Workers-Typen
src/
  api/client.ts             fetch-Hülle, ApiError
  auth/useAuth.ts           globaler Login-Zustand (Composable)
  components/Account/AccountPage.vue
  components/Admin/AdminUsersPage.vue
```

## Datenmodell (D1)

```sql
CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  is_admin      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  id         TEXT PRIMARY KEY,   -- SHA-256-Hash (hex) des Session-Tokens
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL    -- Unix-Zeit in Sekunden
);

CREATE INDEX sessions_user_id ON sessions(user_id);
```

Benutzernamen sind ohne Beachtung der Groß-/Kleinschreibung eindeutig („Josh“ = „josh“).
Gespeichert wird die Schreibweise, mit der der Benutzer angelegt wurde.

## Passwörter

- PBKDF2-SHA256 über Web Crypto mit 100.000 Iterationen (Maximum in Workers),
  16 Byte zufälligem Salt pro Passwort und 32 Byte Ableitung.
- Speicherformat: `pbkdf2$<iterationen>$<salt base64>$<hash base64>`. Die Prüfung liest die
  Iterationszahl aus dem String, damit sie später erhöht werden kann.
- Der Vergleich erfolgt in konstanter Zeit.
- Regeln: mindestens 8, höchstens 128 Zeichen.
- `scripts/create-admin.ts` nutzt dieselbe `hashPassword`-Funktion. Node hat Web Crypto
  (`globalThis.crypto.subtle`).

## Sessions

- Login erzeugt ein zufälliges 32-Byte-Token (base64url). Es wird als Cookie gesetzt:
  `session=<token>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000` (30 Tage).
- In der DB steht nur `SHA-256(token)` als `sessions.id`.
- Nachschlagen: Cookie lesen, hashen, Session + Benutzer per JOIN laden. Abgelaufene Sessions
  zählen als nicht vorhanden und werden dabei gelöscht.
- Logout: Session löschen, Cookie mit `Max-Age=0` überschreiben.
- Admin setzt Passwort zurück: alle Sessions dieses Benutzers löschen.
- Benutzer ändert sein eigenes Passwort: alle Sessions außer der aktuellen löschen.
- Benutzer gelöscht: Sessions verschwinden per `ON DELETE CASCADE`. D1 setzt Foreign Keys
  standardmäßig durch.

## Validierung & Schutzregeln

- Benutzername: wird getrimmt, 3–32 Zeichen aus `[A-Za-z0-9._-]`.
- Login-Fehler liefern immer dieselbe Meldung: „Benutzername oder Passwort falsch“. Auch bei
  unbekanntem Benutzer wird ein Hash berechnet, damit die Antwortzeit nichts verrät.
- Rate Limit für Login über das Workers Rate Limiting Binding (`LOGIN_LIMITER`), Schlüssel ist
  die Client-IP (`CF-Connecting-IP`), Grenze 10 Versuche pro 60 Sekunden. Bei Überschreitung
  kommt `429`.
- Der Admin kann sein eigenes Konto nicht löschen (`403`).
- Der letzte verbleibende Admin kann nicht gelöscht werden (`403`).
- CSRF: `SameSite=Lax` plus Pflicht-Header `Content-Type: application/json` für alle
  schreibenden Anfragen. Fehlt der Header, kommt `415`.

## API

Alle Antworten sind JSON. Fehlerformat: `{ "error": "<deutsche Meldung>" }`.
Benutzerobjekt: `{ id, username, isAdmin }`.

| Methode  | Pfad                            | Zugriff   | Body                                | Antwort                       |
| -------- | ------------------------------- | --------- | ----------------------------------- | ----------------------------- |
| `POST`   | `/api/auth/login`               | öffentlich | `{ username, password }`            | `{ user }` + Set-Cookie       |
| `POST`   | `/api/auth/logout`              | eingeloggt | –                                   | `{ ok: true }` + Cookie löschen |
| `GET`    | `/api/auth/me`                  | öffentlich | –                                   | `{ user }` oder `{ user: null }` |
| `POST`   | `/api/auth/password`            | eingeloggt | `{ currentPassword, newPassword }`  | `{ ok: true }`                |
| `GET`    | `/api/admin/users`              | Admin     | –                                   | `{ users: [{ id, username, isAdmin, createdAt }] }` |
| `POST`   | `/api/admin/users`              | Admin     | `{ username, password, isAdmin? }`  | `201 { user }`                |
| `DELETE` | `/api/admin/users/:id`          | Admin     | –                                   | `{ ok: true }`                |
| `POST`   | `/api/admin/users/:id/password` | Admin     | `{ password }`                      | `{ ok: true }`                |

Statuscodes: `400` ungültige Eingabe oder aktuelles Passwort falsch · `401` nicht eingeloggt /
Login fehlgeschlagen · `403` kein Admin oder verbotene Aktion · `404` Benutzer existiert
nicht · `409` Benutzername vergeben · `415` falscher Content-Type · `429` zu viele
Login-Versuche · `500` unerwarteter Fehler (Meldung „Interner Fehler“, Details nur im Log).

`isAdmin` beim Anlegen nimmt die API an. Die Admin-Oberfläche bietet es aber nicht an
(Ernennen weiterer Admins ist nicht im Umfang).

## Frontend

### `src/api/client.ts`

`api.get(path)`, `api.post(path, body?)`, `api.delete(path)`. Die Hülle setzt
`Content-Type: application/json` und sendet Cookies (same-origin). Bei Status ≥ 400 wirft sie
`ApiError { status, message }`, wobei `message` aus `error` der Antwort kommt. Bei `401` meldet
sie das an `useAuth`, damit `user` auf `null` fällt.

### `src/auth/useAuth.ts`

Modulweiter Zustand `user: Ref<User | null>`, dazu `ensureLoaded()` (lädt `/api/auth/me`
genau einmal, parallele Aufrufe teilen sich das Promise), `login(username, password)`,
`logout()` und `isAdmin` (computed).

### Router

- `RoutePath` bekommt `Account = '/konto'` und `Admin = '/admin'`.
- Die Shop-Routen (`Shop`, `Shopping`, `ShoppingList`, `ShoppingOverview`) und `Account`
  erhalten `meta.requiresAuth`, `Admin` erhält `meta.requiresAdmin`.
- Globaler `beforeEach`:
  1. `await ensureLoaded()`.
  2. `requiresAuth` bzw. `requiresAdmin` ohne Login → `/login?redirect=<ziel>`.
  3. `requiresAdmin` mit Login, aber ohne Admin → `/`.
  4. `/login` mit bestehendem Login → `/konto`.

### Komponenten

- **CampMap.vue:** Shop-Link nur mit `v-if="user"`.
- **SiteHeader.vue:** Ausgeloggt zeigt der Satellit „Login“ → `/login`. Eingeloggt zeigt er den
  Benutzernamen → `/konto`.
- **LoginView.vue:** Ruft `login()` auf. Fehlermeldung unter dem Formular, Button während der
  Anfrage deaktiviert. Nach Erfolg `routerHelper.replace` auf das `redirect`-Ziel, falls es ein
  interner Pfad ist (beginnt mit `/`, nicht mit `//`), sonst auf `/`.
- **AccountPage.vue (`/konto`):** Begrüßung mit Namen. Formular „Passwort ändern“ (aktuelles
  Passwort, neues Passwort, Wiederholung; die Übereinstimmung wird im Client geprüft) mit
  Erfolgs- bzw. Fehlermeldung. Button „Logout“, danach geht es auf die Startseite. Für Admins
  ein Link „Benutzerverwaltung“.
- **AdminUsersPage.vue (`/admin`):** Formular „Benutzer anlegen“ (Benutzername, Startpasswort).
  Darunter die Benutzerliste mit Name, Admin-Kennzeichen und Erstellungsdatum. Pro Zeile
  „Passwort zurücksetzen“ (Eingabefeld direkt in der Zeile + Speichern) und „Löschen“ (mit
  `confirm()`-Bestätigung). Für das eigene Konto ist „Löschen“ ausgeblendet. Nach jeder Aktion
  wird die Liste neu geladen.
- Alle neuen Seiten verwenden die bestehenden Klassen `page-section`, `page-title` und
  `glass-card` sowie den Formularstil von `LoginView.vue`, mobil wie Desktop.

## Erster Admin

`npm run create-admin -- <benutzername> [--remote]`

- Fragt das Passwort verdeckt im Terminal ab (zweimal, muss übereinstimmen, Regeln wie oben).
- Hasht es mit `worker/lib/password.ts`.
- Führt `wrangler d1 execute campmchammergeil [--local|--remote] --command "INSERT ..."` aus,
  mit `is_admin = 1`. Die Werte werden für SQL escaped. Benutzername und Hash sind zuvor
  validiert bzw. enthalten nur base64-Zeichen.

## Datenschutz & Cookies

- **DatenschutzPage.vue:** Neuer Abschnitt „Benutzerkonten“:
  - Gespeicherte Daten: Benutzername, Passwort-Hash, Session-Kennung, Ablaufzeit.
  - Speicherort: Cloudflare D1.
  - Zweck: Zugang zum internen Bereich.
  - Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.
  - Löschung: Sessions nach Logout oder spätestens nach 30 Tagen, Konto beim Löschen durch den
    Admin.
  - Die Abschnittsnummern danach werden angepasst.
- **CookieConsent.vue:** Unter „Essentiell“ kommt der Punkt „Login-Session-Cookie (nur nach
  Anmeldung)“ dazu.
- Der Text ist vorformuliert. Die rechtliche Prüfung liegt beim Betreiber.

## Deployment (Umzug Pages → Workers)

Code-Seite (im Repo): `wrangler.jsonc`, Vite-Plugin, Migration, Skripte. `package.json`
bekommt `deploy` (`npm run build && wrangler deploy`), `db:migrate:local`,
`db:migrate:remote`, `create-admin`, `cf-typegen` und `test`.

Schritte durch den Betreiber (Anleitung wird bei der Umsetzung geliefert):

1. `npx wrangler login` (Browser-Login, kein API-Token nötig).
2. `npx wrangler d1 create campmchammergeil`. Die ID kommt in `wrangler.jsonc`.
3. `npm run db:migrate:remote`.
4. Im Dashboard: Workers & Pages → Create → Import a repository → dieses Repo. Build-Befehl
   `npm run build`, Deploy-Befehl `npx wrangler deploy`.
5. `npm run create-admin -- <name> --remote`.
6. Auf der `*.workers.dev`-URL testen (Erfolgskriterium oben).
7. Eigene Domain im Pages-Projekt entfernen und dem Worker zuweisen. Das Pages-Projekt danach
   abschalten.

## Tests

- **Worker** (Vitest + `@cloudflare/vitest-pool-workers`, echte lokale D1, Migrationen werden
  vor den Tests angewendet):
  - `password`: Hash ≠ Klartext, verify true/false, unterschiedliche Salts.
  - `auth`:
    - Login korrekt/falsch/unbekannter Benutzer mit identischer Meldung
    - Cookie-Attribute, `me` mit und ohne Cookie, abgelaufene Session, Logout
    - Passwort ändern (falsches aktuelles Passwort → 401, andere Sessions gelöscht, aktuelle bleibt)
    - Rate Limit → 429
    - fehlender JSON-Content-Type → 415
  - `admin`:
    - 401 ohne Login, 403 als normaler Benutzer
    - anlegen (400 ungültig, 409 doppelt auch bei anderer Groß-/Kleinschreibung)
    - auflisten ohne Hashes
    - löschen (404, eigenes Konto 403, letzter Admin 403, Sessions des Gelöschten weg)
    - Passwort zurücksetzen (Sessions des Benutzers weg, neues Passwort funktioniert)
- **Frontend** (Vitest, jsdom): `useAuth` (`ensureLoaded` lädt nur einmal, login/logout setzen
  `user`), Router-Guard (Weiterleitungen gemäß Regeln oben, `redirect`-Parameter, Schutz vor
  externen Redirects).
- **Manuell:** `npm run dev`, Durchlauf aller Seiten im Browser (mobil und Desktop).
- **Abschluss:** `npm run build`, `npm run lint` und `npm test` müssen grün sein.
