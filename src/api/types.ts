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

export type ShopOrder = {
  id: number
  itemName: string
  priceCents: number | null
  quantity: number
  // UTC, Format "YYYY-MM-DD HH:MM:SS"
  createdAt: string
}
