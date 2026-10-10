// Löscht alle Bestellungen und gedruckten Listen (Benutzer und Artikel bleiben erhalten).
// Nutzung: npm run reset-shop-data -- [--remote] [--yes]
// Ohne --remote wird die lokale Entwicklungs-Datenbank geleert. Ohne --yes muss „LÖSCHEN“ getippt werden.
import { spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline/promises'

const args = process.argv.slice(2)
const remote = args.includes('--remote')
const target = remote ? 'Produktion' : 'lokal'

if (!args.includes('--yes')) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question(
    `Alle Bestellungen und Listen löschen (${target})? Zum Bestätigen LÖSCHEN eingeben: `,
  )
  rl.close()
  if (answer.trim() !== 'LÖSCHEN') {
    console.error('Abgebrochen.')
    process.exit(1)
  }
}

// Bestellungen zuerst, sie verweisen auf die Listen.
const sql = 'DELETE FROM shop_orders; DELETE FROM shop_lists;'
const result = spawnSync(
  'npx',
  [
    'wrangler',
    'd1',
    'execute',
    'campmchammergeil',
    remote ? '--remote' : '--local',
    '--command',
    `"${sql}"`,
  ],
  { stdio: 'inherit', shell: true },
)
const status = result.status ?? 1

if (status === 0) console.log(`Bestellungen und Listen gelöscht (${remote ? 'remote' : 'lokal'}).`)
process.exit(status)
