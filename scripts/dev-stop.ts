// Beendet den Dev-Server (`npm run dev`) – in allen Arbeitskopien dieses Repos, inklusive Worker.
// Nutzung: npm run dev:stop (auch als Paseo-Skript „dev:stop“, siehe paseo.json). Nur Windows.
import { execFileSync, spawnSync } from 'node:child_process'

if (process.platform !== 'win32') {
  console.error('dev:stop läuft nur unter Windows.')
  process.exit(1)
}

interface ProcessInfo {
  ProcessId: number
  CommandLine: string | null
}

const normalise = (path: string) => path.replaceAll('/', '\\').replace(/\\+$/, '').toLowerCase()

// Haupt-Arbeitskopie + alle Worktrees
const checkouts = spawnSync('git', ['worktree', 'list', '--porcelain'], { encoding: 'utf8' })
  .stdout.split('\n')
  .filter((line) => line.startsWith('worktree '))
  .map((line) => `${normalise(line.slice('worktree '.length))}\\`)

const processes = JSON.parse(
  execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      "@(Get-CimInstance Win32_Process -Filter \"Name = 'node.exe'\" | Select-Object ProcessId, CommandLine) | ConvertTo-Json -Compress",
    ],
    { encoding: 'utf8' },
  ) || '[]',
) as ProcessInfo[]

// Vite-Prozesse (…\node_modules\vite\bin\vite.js), die aus einer Arbeitskopie dieses Repos stammen
const devServers = processes.filter((p) => {
  const commandLine = normalise(p.CommandLine ?? '')
  return /\\vite\\bin\\vite\.js/.test(commandLine) && checkouts.some((c) => commandLine.includes(c))
})

if (devServers.length === 0) {
  console.log('Dev-Server läuft nicht.')
} else {
  for (const { ProcessId } of devServers) {
    // /T beendet auch den Worker (workerd), den Vite gestartet hat
    spawnSync('taskkill', ['/PID', String(ProcessId), '/T', '/F'], { stdio: 'ignore' })
  }
  console.log(`Dev-Server beendet (${devServers.length}).`)
}
