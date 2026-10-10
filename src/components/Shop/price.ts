// Preise werden als ganze Cent gespeichert (priceCents) und immer in Euro angezeigt.

const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })

// 150 -> "1,50 €", null -> "kein Preis"
export function formatPrice(cents: number | null): string {
  return cents === null ? 'kein Preis' : euro.format(cents / 100)
}

// Cent als Eingabetext für das Preisfeld: 150 -> "1,50", null -> ""
export function centsToInput(cents: number | null): string {
  return cents === null ? '' : (cents / 100).toFixed(2).replace('.', ',')
}

export type ParsedPrice = { ok: true; cents: number | null } | { ok: false }

// "1,50" / "1.5" / "2" / "2 €" -> Cent, "" -> null (kein Preis), sonst ungültig.
export function parsePrice(input: string): ParsedPrice {
  const text = input.replace(/€/g, '').replace(/\s+/g, '').replace(',', '.')
  if (text === '') return { ok: true, cents: null }
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(text)) return { ok: false }
  return { ok: true, cents: Math.round(Number(text) * 100) }
}

// Wie formatPrice, aber mit Strich statt Text, z. B. in Tabellenzellen: null -> "–"
export function formatPriceOrDash(cents: number | null): string {
  return cents === null ? '–' : formatPrice(cents)
}

// PayPal.Me-Link (Freunde & Familie) mit vorausgefülltem Betrag in Euro
export function paypalPayUrl(cents: number): string {
  return `https://paypal.me/joshuaniernetz/${(cents / 100).toFixed(2)}EUR`
}
