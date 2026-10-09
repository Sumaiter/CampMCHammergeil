import { applyD1Migrations } from 'cloudflare:test'
import { env } from 'cloudflare:workers'

// Wird vor jeder Testdatei ausgeführt; bereits angewendete Migrationen werden übersprungen.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
