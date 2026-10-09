// Legt einen Admin in der D1-Datenbank an.
// Nutzung: npm run create-admin -- <benutzername> [--remote]
// Ohne --remote landet der Admin in der lokalen Entwicklungs-Datenbank.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { hashPassword } from '../worker/lib/password.ts'
import { buildInsertAdminSql } from './admin-sql.ts'

const args = process.argv.slice(2)
const remote = args.includes('--remote')
const username = args.find((arg) => !arg.startsWith('--'))

if (!username) {
  console.error('Nutzung: npm run create-admin -- <benutzername> [--remote]')
  process.exit(1)
}

// Passwort verdeckt abfragen: Eingaben werden nicht ins Terminal zurückgeschrieben.
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: process.stdin.isTTY,
})
let muted = false
const rlOutput = rl as unknown as { _writeToOutput: (text: string) => void }
rlOutput._writeToOutput = (text) => {
  if (!muted) process.stdout.write(text)
}
const lines = rl[Symbol.asyncIterator]()

async function askHidden(prompt: string): Promise<string> {
  process.stdout.write(prompt)
  muted = true
  const { value } = await lines.next()
  muted = false
  process.stdout.write('\n')
  return typeof value === 'string' ? value : ''
}

const password = await askHidden('Passwort: ')
const repeat = await askHidden('Passwort wiederholen: ')
rl.close()

if (password !== repeat) {
  console.error('Die Passwörter stimmen nicht überein.')
  process.exit(1)
}
if (password.length < 8 || password.length > 128) {
  console.error('Passwort muss 8–128 Zeichen lang sein.')
  process.exit(1)
}

const sql = buildInsertAdminSql(username, await hashPassword(password))
const dir = mkdtempSync(join(tmpdir(), 'create-admin-'))
const file = join(dir, 'insert-admin.sql')

let status = 1
try {
  writeFileSync(file, sql)
  const result = spawnSync(
    'npx',
    [
      'wrangler',
      'd1',
      'execute',
      'campmchammergeil',
      remote ? '--remote' : '--local',
      '--file',
      `"${file}"`,
    ],
    { stdio: 'inherit', shell: true },
  )
  status = result.status ?? 1
} finally {
  rmSync(dir, { recursive: true, force: true })
}

if (status === 0) console.log(`Admin „${username}“ angelegt (${remote ? 'remote' : 'lokal'}).`)
process.exit(status)
