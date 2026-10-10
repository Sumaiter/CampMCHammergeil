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

// PayPal-Zahlungslink (Betrag in Euro mit Punkt und 2 Nachkommastellen)
export function paypalPayUrl(cents: number): string {
  const params = [
    'cmd=_xclick',
    'business=joshua.nierentz%40gmail.com',
    'currency_code=EUR',
    `amount=${(cents / 100).toFixed(2)}`,
    `item_name=${encodeURIComponent('Camp MC Hammergeil Einkauf')}`,
  ]
  return `https://www.paypal.com/cgi-bin/webscr?${params.join('&')}`
}
