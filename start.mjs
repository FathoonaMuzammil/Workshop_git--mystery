#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { platform } from 'node:os'
import { dirname, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import {
  DASHBOARD_PORT,
  DASHBOARD_URL,
  HOST,
  SLIDES_ENTRY,
  SLIDES_PORT,
  SLIDES_URL,
} from './config.mjs'
import { createDashboard } from './dashboard/server.mjs'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)))
const OPEN_TIMEOUT_MS = 90_000

function fail(message, extra = []) {
  process.stderr.write(`\nCannot start the workshop app.\n\n${message}\n`)
  for (const line of extra) process.stderr.write(`${line}\n`)
  process.stderr.write('\n')
  process.exit(1)
}

function slidevBin() {
  return resolve(repoRoot, 'node_modules/@slidev/cli/bin/slidev.mjs')
}

function checkPrerequisites() {
  const bunVersion = process.versions?.bun
  if (!bunVersion) {
    fail('This launcher must be run with Bun.', [
      'Install Bun: https://bun.sh',
      'Then run `bun install` and `bun run start`.',
    ])
  }
  const [major, minor] = bunVersion.split('.').map(Number)
  if (major < 1 || (major === 1 && minor < 1)) {
    fail(`Bun ${bunVersion} is too old. This workshop needs Bun 1.1.0 or newer.`, [
      'Update Bun, then run `bun install` again.',
    ])
  }

  if (spawnSync('git', ['--version'], { stdio: 'ignore' }).error) {
    fail('Git is not available on your PATH.', [
      'Install Git, then open a new terminal and run `bun run start` again.',
    ])
  }

  if (!existsSync(slidevBin())) {
    fail('Dependencies are not installed.', [
      'Run this in the repository root:',
      '  bun install',
      'Then run `bun run start` again.',
    ])
  }

  if (!existsSync(resolve(repoRoot, SLIDES_ENTRY))) {
    fail(`Slide source is missing: ${SLIDES_ENTRY}.`, ['Re-clone the starter repository.'])
  }
}

async function probe(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2000) })
    return response.ok
  } catch {
    return false
  }
}

async function waitFor(url, label, timeoutMs) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (await probe(url)) return true
    await delay(250)
  }
  fail(`${label} did not respond on ${url}.`, [
    'Check the terminal output above for the reason, fix it, and run `bun run start` again.',
  ])
}

function openInBrowser(url) {
  if (process.env.WORKSHOP_NO_BROWSER === '1') return
  const command = platform() === 'darwin' ? 'open' : platform() === 'win32' ? 'cmd' : 'xdg-open'
  const args = platform() === 'win32' ? ['/c', 'start', '""', url] : [url]
  const child = spawn(command, args, { stdio: 'ignore', detached: true })
  child.on('error', () => {})
  child.unref()
}

function startSlides() {
  return spawn(process.execPath, [slidevBin(), SLIDES_ENTRY, '--port', String(SLIDES_PORT), '--remote', HOST], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: { ...process.env, BROWSER: 'none' },
  })
}

async function main() {
  checkPrerequisites()

  const dashboard = createDashboard({ repoRoot, log: (message) => process.stderr.write(`${message}\n`) })

  try {
    await dashboard.listen()
  } catch (error) {
    if (error.code === 'EADDRINUSE') {
      fail(`Port ${DASHBOARD_PORT} is already in use.`, [
        'Find the process holding it and stop it, for example:',
        `  lsof -ti tcp:${DASHBOARD_PORT} | xargs kill`,
        'The app does not move to another port so its links stay predictable.',
      ])
    }
    fail(`Dashboard failed to start: ${error.message}`)
  }

  const slides = startSlides()

  const stop = async (code) => {
    slides.kill('SIGTERM')
    // Never let a lingering socket keep the port bound after shutdown.
    await Promise.race([dashboard.close().catch(() => {}), delay(2000)])
    process.exit(code)
  }

  process.on('SIGINT', () => stop(0))
  process.on('SIGTERM', () => stop(0))
  slides.on('exit', (code) => {
    process.stderr.write(`\nSlides stopped (exit ${code}). Stopping the dashboard too.\n`)
    stop(code ?? 0)
  })

  await waitFor(SLIDES_URL, 'Slides', OPEN_TIMEOUT_MS)
  await waitFor(`${DASHBOARD_URL}/health`, 'Dashboard', 15_000)

  process.stdout.write(`\nSlides:    ${SLIDES_URL}\nDashboard: ${DASHBOARD_URL}\n\n`)
  if (process.env.WORKSHOP_NO_BROWSER === '1') {
    process.stdout.write('Browser opening is disabled (WORKSHOP_NO_BROWSER=1).\n')
  } else {
    process.stdout.write('Opening both in your browser.\n')
  }
  openInBrowser(SLIDES_URL)
  openInBrowser(DASHBOARD_URL)
}

main().catch((error) => fail(error.message))