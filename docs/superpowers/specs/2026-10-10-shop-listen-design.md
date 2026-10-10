# Shop: Listen drucken, Übersicht, Einkaufen für andere – Design

## Ablauf

- Bestellpositionen ohne `list_id` bilden die **Aktuelle Liste** (offen). Solange sie offen sind,
  können Empfänger (`user_id`) und Besteller (`ordered_by_user_id`) die Menge ändern oder die Position löschen.
- Ein Admin druckt unter **Liste drucken** alle offenen Positionen aller Benutzer. Dabei entsteht eine
  `shop_lists`-Zeile mit Zeitstempel; alle offenen Positionen bekommen deren `list_id` und den aktuellen
  Artikelpreis als `price_cents` festgeschrieben. Danach sind sie nicht mehr änderbar und erscheinen in der
  **Übersicht**. Mehrere Drucke am selben Tag unterscheiden sich durch Uhrzeit (und Listen-ID).
- Preis einer Position: `COALESCE(o.price_cents, i.price_cents)` – festgeschriebener Preis, sonst der
  (evtl. nachgetragene) aktuelle Artikelpreis, sonst `null` (= noch kein Preis, zählt nicht zur Summe).
- **Einkaufen für andere**: Beim Bestellen kann ein anderer Benutzer als Empfänger gewählt werden. Beide sehen
  die Position (Aktuelle Liste und Übersicht), **berechnet wird sie nur dem Empfänger**.
- **Übersicht**: jeder sieht nur Positionen, bei denen er Empfänger oder Besteller ist; Admins können den
  Benutzer wechseln. Admins sehen zusätzlich „Wer muss was zahlen“ (Summe pro Empfänger über alle Listen).
- **Alte Listen** (Admin): alle gedruckten Listen, neueste zuerst, mit Detailansicht und erneutem PDF-Download.
- Das PDF wird im Browser mit `jspdf` + `jspdf-autotable` erzeugt (bereits installiert).

## Datenbank – `migrations/0004_shop_lists.sql`

```sql
CREATE TABLE shop_lists (
  id         INTEGER PRIMARY KEY,
  printed_at TEXT NOT NULL DEFAULT (datetime('now')),
  printed_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);
ALTER TABLE shop_orders ADD COLUMN list_id INTEGER REFERENCES shop_lists(id);
ALTER TABLE shop_orders ADD COLUMN ordered_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE shop_orders ADD COLUMN price_cents INTEGER;
UPDATE shop_orders SET ordered_by_user_id = user_id;
CREATE INDEX shop_orders_list_id ON shop_orders(list_id);
CREATE INDEX shop_orders_ordered_by ON shop_orders(ordered_by_user_id);
```

## API (`/api/shop`, JSON camelCase, Typen siehe `src/api/types.ts`)

`ShopOrder` = `{ id, itemId, itemName, priceCents, quantity, createdAt, userId, username, orderedById,
orderedByName, listId, printedAt }` (Zeitstempel UTC `YYYY-MM-DD HH:MM:SS`).

Bestehend, unverändert: `GET/POST /items`, `PUT /items/:id`.

| Methode + Pfad | Recht | Body / Query | Antwort |
|---|---|---|---|
| `GET /users` | User | – | `{ users: ShopUser[] }` alle Benutzer, alphabetisch (NOCASE) |
| `POST /orders` | User | `{ forUserId?: number, items: [{ itemId, quantity }] }` | 201 `{ ok: true }`. `forUserId` fehlt → selbst. Unbekannter Benutzer → 400 `'Unbekannter Benutzer'`. Sonst Validierung wie bisher. `ordered_by_user_id` = eingeloggter User. |
| `GET /orders` | User | – | `{ orders: ShopOrder[] }` **offene** Positionen, bei denen ich Empfänger **oder** Besteller bin; neueste zuerst |
| `PUT /orders/:id` | User | `{ quantity }` (1..999) | `{ order: ShopOrder }`. Nur offen und nur Empfänger/Besteller, sonst 404 `'Bestellung nicht gefunden'` (bereits gedruckt → 409 `'Liste wurde bereits gedruckt'`) |
| `DELETE /orders/:id` | User | – | `{ ok: true }`, gleiche Regeln wie PUT |
| `GET /open-orders` | Admin | – | `{ orders: ShopOrder[] }` alle offenen Positionen aller Benutzer, sortiert nach Empfänger (NOCASE), dann Artikel |
| `POST /lists` | Admin | `{}` | 201 `{ list: ShopListDetail }`. Keine offenen Positionen → 400 `'Keine offenen Bestellungen'`. Atomar in **einem** `db.batch`: Liste anlegen, offene Positionen zuweisen + Preis festschreiben (`(SELECT MAX(id) FROM shop_lists)`). Positionen, die nach dem Batch eintreffen, bleiben offen. |
| `GET /lists` | Admin | – | `{ lists: ShopList[] }` neueste zuerst; `totalCents` = Summe Preis×Menge der Positionen mit Preis, `unpricedCount` = Anzahl Positionen ohne Preis |
| `GET /lists/:id` | Admin | – | `{ list: ShopListDetail }` (Positionen sortiert wie `/open-orders`), unbekannt → 404 `'Liste nicht gefunden'` |
| `GET /overview?userId=` | User | `userId` optional; nur Admin darf fremde ID angeben (sonst 403) | `{ orders: ShopOrder[] }` **gedruckte** Positionen, bei denen der Benutzer Empfänger oder Besteller ist; sortiert `printed_at DESC, list_id DESC`, dann Artikel |
| `GET /balances` | Admin | – | `{ balances: ShopBalance[] }` pro Empfänger über alle gedruckten Listen, nur Benutzer mit Positionen, alphabetisch |

Hinweis: Der Client (`src/api/client.ts`) schickt bei DELETE immer `Content-Type: application/json`.
