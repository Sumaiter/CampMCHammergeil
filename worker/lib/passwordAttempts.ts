import { HttpError } from './validation'

// Bremst das Durchprobieren von Passwörtern pro Konto – unabhängig von der IP. Gezählt wird vor der
// Prüfung, damit auch gleichzeitige Anfragen nicht an der Grenze vorbeirutschen; ein richtiges
// Passwort setzt den Zähler zurück. Unbekannte Namen zählen genauso, damit die Sperre nichts verrät.
const MAX_ATTEMPTS = 10
const WINDOW_SECONDS = 15 * 60

export async function countPasswordAttempt(
  db: D1Database,
  username: string,
  now = Date.now(),
): Promise<void> {
  const nowSeconds = Math.floor(now / 1000)
  const row = await db
    .prepare(
      `INSERT INTO login_attempts (username, attempts, reset_at) VALUES (?, 1, ?)
       ON CONFLICT (username) DO UPDATE SET
         attempts = CASE WHEN reset_at <= ? THEN 1 ELSE attempts + 1 END,
         reset_at = CASE WHEN reset_at <= ? THEN excluded.reset_at ELSE reset_at END
       RETURNING attempts`,
    )
    .bind(username, nowSeconds + WINDOW_SECONDS, nowSeconds, nowSeconds)
    .first<{ attempts: number }>()
  if (row!.attempts > MAX_ATTEMPTS) {
    throw new HttpError(429, 'Zu viele Fehlversuche. Bitte warte 15 Minuten.')
  }
}

// Nach richtigem Passwort; abgelaufene Einträge anderer Namen werden dabei mit aufgeräumt.
export async function resetPasswordAttempts(
  db: D1Database,
  username: string,
  now = Date.now(),
): Promise<void> {
  await db
    .prepare('DELETE FROM login_attempts WHERE username = ? OR reset_at <= ?')
    .bind(username, Math.floor(now / 1000))
    .run()
}
