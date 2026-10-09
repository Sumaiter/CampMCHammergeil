import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vitest/config'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin'

export default defineConfig({
  test: {
    projects: [
      // API-Tests laufen in der echten Workers-Laufzeit gegen eine lokale D1
      {
        plugins: [
          cloudflareTest(async () => ({
            wrangler: { configPath: './wrangler.jsonc' },
            miniflare: {
              bindings: { TEST_MIGRATIONS: await readD1Migrations('./migrations') },
            },
          })),
        ],
        test: {
          name: 'worker',
          include: ['worker/**/*.test.ts'],
          setupFiles: ['./worker/test/apply-migrations.ts'],
        },
      },
      // Frontend-Logik und Skripte laufen in Node
      {
        resolve: {
          alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
        },
        test: {
          name: 'web',
          environment: 'node',
          include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
        },
      },
    ],
  },
})
