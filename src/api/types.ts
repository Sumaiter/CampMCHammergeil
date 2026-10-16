export type User = {
  id: number
  username: string
  isAdmin: boolean
  mustChangePassword: boolean
}

export type AdminUser = Omit<User, 'mustChangePassword'> & { createdAt: string }

export type ShopItem = {
  id: number
  name: string
  priceCents: number | null
}

// Eine Bestellposition. userId = für wen bestellt (nur diesem wird sie berechnet),
// orderedById = wer sie eingetragen hat (null, falls dieses Konto gelöscht wurde).
// priceCents: beim Drucken festgehaltener Preis, sonst der aktuelle Artikelpreis (null = noch kein Preis).
export type ShopOrder = {
  id: number
  itemId: number
  itemName: string
  priceCents: number | null
  quantity: number
  // UTC, Format "YYYY-MM-DD HH:MM:SS"
  createdAt: string
  userId: number
  username: string
  orderedById: number | null
  orderedByName: string | null
  // null = noch offen (Aktuelle Liste), sonst die gedruckte Liste
  listId: number | null
  printedAt: string | null
}

export type ShopUser = { id: number; username: string }

// Eine gedruckte Liste; printedAt (UTC) unterscheidet mehrere Drucke am selben Tag.
export type ShopList = {
  id: number
  printedAt: string
  printedByName: string | null
  orderCount: number
  totalCents: number
  unpricedCount: number
}

export type ShopListDetail = {
  id: number
  printedAt: string
  printedByName: string | null
  orders: ShopOrder[]
}

// Summe pro Empfänger über alle gedruckten Listen.
export type ShopBalance = {
  userId: number
  username: string
  totalCents: number
  unpricedCount: number
}

// Wetter am Nürburgring (GET /api/weather). Temperaturen in °C.
export type WeatherCondition = 'clear' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm'

// Was der Planet darstellt; intensity 0..1.
export type WeatherScene = { condition: WeatherCondition; intensity: number }

export type Weather = {
  current: WeatherScene & { temperature: number; isDay: boolean; windKmh: number }
  daily: {
    date: string
    condition: WeatherCondition
    max: number
    min: number
    rainChance: number | null
  }[]
  updatedAt: string // ISO, Zeitpunkt der Abfrage bei Open-Meteo
}
