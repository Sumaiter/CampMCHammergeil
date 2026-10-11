// Veröffentlicht den Stand der Haupt-Arbeitskopie: D1-Migrationen (remote) anwenden, dann bauen und deployen.
// Nutzung: npm run release (auch als Paseo-Skript „deploy“, siehe paseo.json)
// Läuft immer in der Haupt-Arbeitskopie, auch wenn es aus einem Worktree gestartet wird.
import { spawnSync } from 'node:child_process'

function run(command: string, cwd: string) {
  console.log(`\n> ${command}`)
  const result = spawnSync(command, { cwd, stdio: 'inherit', shell: true })
  const status = result.status ?? 1
  if (status !== 0) {
    console.error(`\nAbgebrochen: „${command}“ ist fehlgeschlagen.`)
    process.exit(status)
  }
}

function git(args: string[]): string {
  return spawnSync('git', args, { encoding: 'utf8' }).stdout.trim()
}

// Der erste Eintrag von `git worktree list` ist immer die Haupt-Arbeitskopie
const mainCheckout = git(['worktree', 'list', '--porcelain'])
  .split('\n')[0]
  ?.replace(/^worktree /, '')
if (!mainCheckout) {
  console.error('Haupt-Arbeitskopie nicht gefunden.')
  process.exit(1)
}

const commit = git(['-C', mainCheckout, 'log', '-1', '--format=%h (%D) %s'])
console.log(`Verzeichnis: ${mainCheckout}`)
console.log(`Stand:       ${commit}`)

run('npm run db:migrate:remote', mainCheckout)
run('npm run deploy', mainCheckout)

console.log('\nFertig: Datenbank migriert und deployt.')
