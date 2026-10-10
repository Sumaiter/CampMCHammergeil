# CampMCHammergeil

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```

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

Alle Befehle:

```sh
npm run dev                            # App + API + lokale D1 (Vite + @cloudflare/vite-plugin)
npm test                               # Worker- und Frontend-Tests (Vitest)
npm run db:migrate:local               # Migrationen auf die lokale D1 anwenden
npm run create-admin -- <name>         # Admin in der lokalen D1 anlegen
npm run create-admin -- <name> --remote  # Admin in der Produktions-D1 anlegen
npm run db:migrate:remote              # Migrationen auf die Produktions-D1 anwenden
npm run deploy                         # Build + wrangler deploy
```

Nach Änderungen an `wrangler.jsonc` die Typen neu erzeugen: `npm run cf-typegen`.
