-- Passwortversuche pro Benutzername (auch unbekannte Namen), damit Brute-Force über viele IPs
-- gebremst wird. Festes Zeitfenster: ab reset_at (Unix-Zeit in Sekunden) beginnt die Zählung neu.
CREATE TABLE login_attempts (
  username TEXT PRIMARY KEY COLLATE NOCASE,
  attempts INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);
