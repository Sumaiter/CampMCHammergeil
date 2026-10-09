export type User = { id: number; username: string; isAdmin: boolean }

export type AdminUser = User & { createdAt: string }
