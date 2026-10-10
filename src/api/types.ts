export type User = {
  id: number
  username: string
  isAdmin: boolean
  mustChangePassword: boolean
}

export type AdminUser = Omit<User, 'mustChangePassword'> & { createdAt: string }
