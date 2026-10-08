import { afterAll, describe, expect, test } from 'bun:test'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { sourceRoot } from '../scripts/workspace.mjs'
import { DASHBOARD_PORT, SLIDES_PORT } from '../config.mjs'

const launcher = resolve(sourceRoot, 'start.mjs')
const startEnv = { ...process.env, WORKSHOP_NO_BROWSER: '1' }

function probe(url) {
  return fetch(url, { signal: AbortSignal.timeout(2500) })
    .then((response) => response.ok)
    .catch(() => false)
}

async function waitUntil(check, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await check()) return true
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

describe('one start command', () => {
  let child

  afterAll(async () => {
    if (child && !child.killed) child.kill('SIGTERM')
    await waitUntil(async () => !(await probe(`http://127.0.0.1:${DASHBOARD_PORT}/health`)), 15_000)
  })

  test('starts both servers, and stopping it stops both', async () => {
    child = spawn(process.execPath, [launcher], { cwd: sourceRoot, env: startEnv, stdio: 'pipe' })

    let output = ''
    child.stdout.on('data', (chunk) => (output += chunk))
    child.stderr.on('data', (chunk) => (output += chunk))

    const slidesUp = await waitUntil(() => probe(`http://127.0.0.1:${SLIDES_PORT}/`), 150_000)
    const dashboardUp = await waitUntil(() => probe(`http://127.0.0.1:${DASHBOARD_PORT}/health`), 20_000)

    expect(output).toContain(`http://127.0.0.1:${DASHBOARD_PORT}`)
    expect(slidesUp).toBe(true)
    expect(dashboardUp).toBe(true)

    const page = await fetch(`http://127.0.0.1:${DASHBOARD_PORT}/`)
    expect(await page.text()).toContain('First Byte')

    child.kill('SIGTERM')
    const slidesDown = await waitUntil(async () => !(await probe(`http://127.0.0.1:${SLIDES_PORT}/`)), 30_000)
    const dashboardDown = await waitUntil(async () => !(await probe(`http://127.0.0.1:${DASHBOARD_PORT}/health`)), 30_000)

    expect(slidesDown).toBe(true)
    expect(dashboardDown).toBe(true)
  }, 240_000)

  test('refuses to start on an occupied port and says how to recover', async () => {
    const blocker = createServer((_req, res) => res.end('blocked'))
    await new Promise((r) => blocker.listen(DASHBOARD_PORT, '127.0.0.1', r))

    try {
      const failure = spawn(process.execPath, [launcher], { cwd: sourceRoot, env: startEnv, stdio: 'pipe' })
      let output = ''
      failure.stdout.on('data', (chunk) => (output += chunk))
      failure.stderr.on('data', (chunk) => (output += chunk))

      const code = await new Promise((r) => failure.on('exit', r))

      expect(code).not.toBe(0)
      expect(output).toContain(`${DASHBOARD_PORT}`)
      expect(output).toContain('lsof')
    } finally {
      await new Promise((r) => blocker.close(r))
    }
  }, 60_000)
})