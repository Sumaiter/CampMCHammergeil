# CampMCHammergeil

Webseite für das Camp MC Hammergeil: Countdown-Karte bis zum Camp und Festival, Login mit
Benutzerkonto sowie ein Einkaufs-Shop (Artikelliste, Bestellungen, Druck der Einkaufslisten,
Übersicht und Salden). Admins verwalten Benutzer, Artikel und gedruckte Listen.

- Frontend: Vue 3 (`<script setup>`, TypeScript, SCSS), Vue Router, Vite
- Backend: Cloudflare Worker mit Hono und D1-Datenbank (siehe unten)
- Tests: Vitest; Linting mit oxlint und ESLint, Formatierung mit Prettier

## Entwicklung

```sh
npm install
npm run dev          # Dev-Server (App + API + lokale D1)
npm run build        # Type-Check + Produktions-Build
npm run type-check   # nur Typen prüfen
npm run lint         # oxlint + ESLint (mit --fix)
npm run format       # Prettier auf src/
```

Projektstruktur: `src/` (Vue-App, `src/api` = API-Client, `src/components/Shop` = Shop),
`worker/` (API), `migrations/` (D1-Schema), `scripts/` (Hilfsskripte).

## Backend (Cloudflare Worker + D1)

Die Seite läuft als Cloudflare Worker: `/api/*` beantwortet der Worker (`worker/`), alles andere
ist die Vue-App. Benutzer und Sessions liegen in der D1-Datenbank `campmchammergeil`.

Erste Einrichtung lokal (einmalig, in dieser Reihenfolge – ohne Migration liefert der Login 500):

```sh
npm run db:migrate:local               # Tabellen in der lokalen D1 anlegen
npm run create-admin -- <name>         # ersten Admin anlegen (fragt nach dem Passwort)
npm run dev
```

`create-admin` ist ein TypeScript-Skript, das Node direkt ausführt – dafür ist Node ≥ 22.18 nötig.

Passwortwechsel und Konto: Legt ein Admin einen Benutzer an oder setzt ein Passwort zurück, muss der
Benutzer es beim nächsten Login ändern (`users.must_change_password`). Bis dahin antwortet die API
auf alles außer `GET /api/auth/me`, `POST /api/auth/login|logout|password` und
`DELETE /api/auth/account` mit `403` und `{ "code": "password_change_required" }`. Der per Skript
angelegte erste Admin wählt sein Passwort selbst und ist davon nicht betroffen. Benutzer können ihr
Konto selbst löschen (`DELETE /api/auth/account` mit `{ "password": … }`); der letzte Admin ist
davon ausgenommen (`409`). Das Löschen ist ein Soft Delete (`users.deleted_at`): Der Benutzer kann sich
nicht mehr anmelden und verschwindet aus Benutzerlisten, seine Bestellungen und Namen in Listen und
Salden bleiben aber erhalten; der Benutzername bleibt reserviert.

Testdaten zurücksetzen: `DELETE /api/admin/shop-data` (nur Admins) löscht alle Bestellungen und
gedruckten Listen und antwortet mit `{ "ok": true, "deletedOrders": …, "deletedLists": … }`. Benutzer und
Artikel bleiben bestehen. Dasselbe per Kommandozeile: `npm run reset-shop-data -- [--remote] [--yes]`
(fragt zur Bestätigung nach „LÖSCHEN“, `--yes` überspringt die Abfrage).

Alle Befehle:

```sh
npm run dev                            # App + API + lokale D1 (Vite + @cloudflare/vite-plugin)
npm test                               # Worker- und Frontend-Tests (Vitest)
npm run db:migrate:local               # Migrationen auf die lokale D1 anwenden
npm run create-admin -- <name>         # Admin in der lokalen D1 anlegen
npm run create-admin -- <name> --remote  # Admin in der Produktions-D1 anlegen
npm run reset-shop-data                # Bestellungen + Listen in der lokalen D1 löschen (--remote: Produktion)
npm run db:migrate:remote              # Migrationen auf die Produktions-D1 anwenden
npm run deploy                         # Build + wrangler deploy
npm run release                        # in der Haupt-Arbeitskopie: Remote-Migrationen + deploy
```

In Paseo steht `release` als Skript „deploy“ zur Verfügung (`paseo.json`).

Nach Änderungen an `wrangler.jsonc` die Typen neu erzeugen: `npm run cf-typegen`.
