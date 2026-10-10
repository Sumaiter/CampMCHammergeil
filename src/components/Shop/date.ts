// Datumshelfer: Der Server liefert UTC im Format "YYYY-MM-DD HH:MM:SS", angezeigt wird lokal.

const dateFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' })
const timeFormat = new Intl.DateTimeFormat('de-DE', { timeStyle: 'short' })

export function parseServerDate(value: string): Date {
  return new Date(value.replace(' ', 'T') + 'Z')
}

// "2026-10-10 12:30:00" -> lokal, z. B. "10.10.2026, 14:30"
export function formatDateTime(value: string): string {
  const date = parseServerDate(value)
  return `${dateFormat.format(date)}, ${timeFormat.format(date)}`
}

// Titel einer gedruckten Liste; die Uhrzeit unterscheidet mehrere Drucke am selben Tag.
export function formatListTitle(printedAt: string): string {
  return `Liste vom ${formatDateTime(printedAt)} Uhr`
}
