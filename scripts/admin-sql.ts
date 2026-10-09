const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,32}$/

const quote = (value: string) => `'${value.replaceAll("'", "''")}'`

// Baut das SQL zum Anlegen eines Admins für `wrangler d1 execute --file`.
export function buildInsertAdminSql(username: string, passwordHash: string): string {
  if (!USERNAME_PATTERN.test(username)) {
    throw new Error(
      'Benutzername muss 3–32 Zeichen lang sein und darf nur Buchstaben, Ziffern, . _ - enthalten',
    )
  }
  return `INSERT INTO users (username, password_hash, is_admin) VALUES (${quote(username)}, ${quote(passwordHash)}, 1);`
}
