-- 1 = Benutzer muss sein Passwort ändern, bevor er die App nutzen kann
-- (nach Anlegen oder Zurücksetzen durch einen Admin).
ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;
