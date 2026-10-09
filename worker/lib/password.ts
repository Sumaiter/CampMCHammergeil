// Passwort-Hashing mit PBKDF2-SHA256 über Web Crypto.
// Bewusst ohne Imports, damit auch das Node-Skript scripts/create-admin.ts diese Datei nutzen kann.

const ITERATIONS = 100_000 // Maximum, das Cloudflare Workers für PBKDF2 erlaubt
const SALT_BYTES = 16
const HASH_BITS = 256

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
const fromBase64 = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0))

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    HASH_BITS,
  )
  return new Uint8Array(bits)
}

// Vergleich in konstanter Zeit, damit die Antwortzeit nichts über den Hash verrät
function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!
  return diff === 0
}

// Format: pbkdf2$<iterationen>$<salt base64>$<hash base64>
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const hash = await derive(password, salt, ITERATIONS)
  return `pbkdf2$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iterationsText, saltText, hashText] = stored.split('$')
  const iterations = Number(iterationsText)
  if (scheme !== 'pbkdf2' || !Number.isInteger(iterations) || iterations <= 0) return false
  if (!saltText || !hashText) return false

  try {
    const expected = fromBase64(hashText)
    const actual = await derive(password, fromBase64(saltText), iterations)
    return equalBytes(actual, expected)
  } catch {
    return false
  }
}
