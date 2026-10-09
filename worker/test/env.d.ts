import type { D1Migration } from 'cloudflare:test'

// Test-Binding aus vitest.config.ts
declare global {
  namespace Cloudflare {
    interface Env {
      TEST_MIGRATIONS: D1Migration[]
    }
  }
}
