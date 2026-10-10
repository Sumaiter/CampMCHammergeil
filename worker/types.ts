export type User = {
  id: number
  username: string
  isAdmin: boolean
  mustChangePassword: boolean
}

export type AppEnv = {
  Bindings: Env
  Variables: { user: User | null; sessionId: string | null }
}
