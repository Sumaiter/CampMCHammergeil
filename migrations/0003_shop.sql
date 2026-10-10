-- Shop-Artikel; der Preis ist optional und wird in Cent gespeichert.
CREATE TABLE shop_items (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  price_cents INTEGER,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Eine Zeile pro Artikel einer Bestellung; Zeilen derselben Bestellung teilen sich created_at.
CREATE TABLE shop_orders (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id    INTEGER NOT NULL REFERENCES shop_items(id),
  quantity   INTEGER NOT NULL CHECK (quantity > 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX shop_orders_user_id ON shop_orders(user_id);
