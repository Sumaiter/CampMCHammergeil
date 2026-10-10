-- Gedruckte Einkaufslisten. Offene Bestellpositionen haben list_id = NULL; beim Drucken bekommen sie
-- die list_id und den damaligen Artikelpreis festgeschrieben. ordered_by_user_id = wer bestellt hat
-- (kann vom Empfänger user_id abweichen, berechnet wird nur dem Empfänger).
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
