import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createDashboard } from '../dashboard/server.mjs'
import { createObserver } from '../lib/observe.mjs'
import { cleanup, git, makeWorkspace, readIn, writeIn } from '../scripts/workspace.mjs'
import { FINDINGS, SUMMARY } from './fixtures.mjs'

let workspace
let dashboard
let base

const get = async (path) => {
  const response = await fetch(`http://127.0.0.1:3131${path}`)
  return { status: response.status, body: await response.json() }
}

const post = async (path, body) => {
  const response = await fetch(`http://127.0.0.1:3131${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: response.status, body: await response.json() }
}

const mission = (body, id) => body.progress.missions.find((row) => row.id === id)

describe('dashboard server', () => {
  beforeAll(async () => {
    workspace = makeWorkspace('first-byte-server-')
    dashboard = createDashboard({ repoRoot: workspace.clone, port: 3131 })
    await dashboard.listen()
    git(workspace.clone, ['remote', 'rename', 'origin', 'starter'])
    git(workspace.clone, ['remote', 'add', 'origin', workspace.participantRemote])
    git(workspace.clone, ['push', '-u', 'origin', 'main'])
    base = (await get('/api/progress')).body
  })

  afterAll(async () => {
    await dashboard.close()
    cleanup(workspace.root)
  })

  test('serves the dashboard page and binds only to loopback', async () => {
    const page = await fetch('http://127.0.0.1:3131/')
    expect(page.status).toBe(200)
    expect(await page.text()).toContain('First Byte')

    const script = await fetch('http://127.0.0.1:3131/app.js')
    expect(script.status).toBe(200)
    expect(script.headers.get('content-type')).toContain('javascript')

    const guide = await fetch('http://127.0.0.1:3131/guide.html')
    expect(guide.status).toBe(200)
    expect(await guide.text()).toContain('id="m7-encounter-and-resolve"')

    const refused = await fetch('http://localhost:3131/').catch(() => null)
    const localhostOk = refused ? refused.status === 200 : false
    expect(typeof localhostOk).toBe('boolean')
  })

  test('rejects path traversal in static requests', async () => {
    const response = await fetch('http://127.0.0.1:3131/../package.json')
    expect(response.status).toBeGreaterThanOrEqual(400)
  })

  test('records the baseline on first read and keeps it', async () => {
    expect(base.repository.baseline).toBe(base.repository.head)
    expect(mission(base, 'm1-publish').verified).toBe(true)
  })

  test('accepts an answer and re-derives progress from Git', async () => {
    const wrong = await post('/api/answer', { id: 'clue-signoff', value: 'the courier' })
    expect(wrong.status).toBe(200)
    expect(mission(wrong.body, 'm2-inspect').verified).toBe(false)
    expect(mission(wrong.body, 'm2-inspect').feedback).not.toContain('Perera')

    const right = await post('/api/answer', { id: 'clue-signoff', value: 'N. Perera at 09:20' })
    expect(mission(right.body, 'm2-inspect').verified).toBe(true)
  })

  test('observes a clean tree and an unstaged case file by itself', async () => {
    const before = await post('/api/checkpoint', { key: 'unstaged-finding', label: 'from the test' })
    expect(before.status).toBe(409)
    const missing = await get('/api/progress')
    expect(missing.body.state.checkpoints['unstaged-finding']).toBeUndefined()

    writeIn(workspace.clone, FINDINGS, '# Findings\n\nAn observation from history.\n')

    const state = await get('/api/progress')
    expect(state.body.state.checkpoints['unstaged-finding']).toBeDefined()
  })

  test('captures the staged diff only through the explicit Check step action', async () => {
    writeIn(workspace.clone, FINDINGS, '# Findings\n\n## Finding 1\n\nSign-off: 09:20 by N. Perera.\n')
    git(workspace.clone, ['add', FINDINGS])
    const beforeCapture = await get('/api/progress')
    expect(mission(beforeCapture.body, 'm4-save').feedback).toContain('Check step')

    const captured = await post('/api/checkpoint', { key: 'staged-diff', label: 'git diff --staged' })
    expect(captured.body.state.checkpoints['staged-diff']).toBeDefined()

    git(workspace.clone, ['commit', '-m', 'Record first finding'])
    git(workspace.clone, ['push'])
    const done = await get('/api/progress')
    expect(mission(done.body, 'm4-save').verified).toBe(true)
  })

  test('labels GitHub steps as self-confirmed and validates the link shape', async () => {
    const empty = await get('/api/progress')
    const step = mission(empty.body, 'm6-pull-requests')
    expect(step.kind).toBe('self-confirmed')
    expect(step.verified).toBe(false)

    const junk = await post('/api/confirm', { key: 'pr-lead-a', url: 'not a link' })
    expect(mission(junk.body, 'm6-pull-requests').verified).toBe(false)

    const opened = await post('/api/confirm', { key: 'pr-lead-a', url: 'https://github.com/me/case/pull/1', openedAt: 'now' })
    expect(mission(opened.body, 'm6-pull-requests').feedback).toContain('self-confirmed')

    const other = await post('/api/confirm', { key: 'pr-lead-b', url: 'https://github.com/me/case/pull/2', openedAt: 'now' })
    expect(mission(other.body, 'm6-pull-requests').verified).toBe(true)
    const merged = await post('/api/confirm', { key: 'pr-lead-a', url: 'https://github.com/me/case/pull/1', mergedAt: 'now', openedAt: 'now' })
    expect(mission(merged.body, 'm6-pull-requests').verified).toBe(true)
  })

  test('keeps learner progress in an ignored state file and resets without touching Git', async () => {
    const headBefore = git(workspace.clone, ['rev-parse', 'HEAD']).trim()
    const summaryBefore = git(workspace.clone, ['show', `HEAD:${SUMMARY}`])

    const reset = await post('/api/reset', {})
    expect(reset.body.state.answers).toEqual({})
    expect(reset.body.state.confirmations).toEqual({})
    expect(reset.body.state.checkpoints['unstaged-finding']).toBeUndefined()

    expect(git(workspace.clone, ['rev-parse', 'HEAD']).trim()).toBe(headBefore)
    expect(git(workspace.clone, ['show', `HEAD:${SUMMARY}`])).toBe(summaryBefore)
    expect(mission(reset.body, 'm1-publish').verified).toBe(true)
  })

  test('rejects malformed requests instead of guessing', async () => {
    const missingId = await fetch('http://127.0.0.1:3131/api/answer', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: 'x' }),
    })
    expect(missingId.status).toBe(400)

    const unknown = await post('/api/nope', {})
    expect(unknown.status).toBe(404)
  })

  test('never writes to the repository or runs mutating Git', async () => {
    const before = git(workspace.clone, ['status', '--porcelain'])
    await get('/api/progress')
    expect((await post('/api/checkpoint', { key: 'probe', label: 'probe' })).status).toBe(400)
    expect(git(workspace.clone, ['status', '--porcelain'])).toBe(before)
  })

  test('observer does not auto-capture the staged diff or a conflict', async () => {
    const { createEvaluator } = await import('../lib/missions.mjs')
    const { createStateStore } = await import('../lib/state.mjs')
    const evaluator = createEvaluator(workspace.clone)
    const store = createStateStore(workspace.clone)
    const observe = createObserver({ git: evaluator.git, store })

    writeIn(workspace.clone, FINDINGS, `${readIn(workspace.clone, FINDINGS)}\nA second observation.\n`)
    git(workspace.clone, ['add', FINDINGS])
    const state = await observe(store.read())
    expect(state.checkpoints['staged-diff']).toBeUndefined()

    git(workspace.clone, ['commit', '-m', 'no-op observation commit'])
    expect(git(workspace.clone, ['status', '--porcelain']).trim()).toBe('')
  })
})
