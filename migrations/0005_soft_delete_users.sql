-- Gelöschte Benutzer bleiben als Zeile erhalten, damit ihre Bestellungen erhalten bleiben.
-- NULL = aktiv, sonst Zeitpunkt der Löschung.
ALTER TABLE users ADD COLUMN deleted_at TEXT;
