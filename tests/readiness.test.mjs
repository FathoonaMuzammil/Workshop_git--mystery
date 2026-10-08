import { afterEach, describe, expect, test } from 'bun:test'
import { createDashboard } from '../dashboard/server.mjs'
import { createEvaluator } from '../lib/missions.mjs'
import { runRehearsal } from '../scripts/rehearse.mjs'
import { cleanup, git, makeWorkspace, readIn, writeIn } from '../scripts/workspace.mjs'
import { SUMMARY } from './fixtures.mjs'

const roots = []
const dashboards = []
const A = 'signed off at 09:20 by N. Perera'
const B = 'sealed copy received at 11:05 by S. Silva'

afterEach(async () => {
  for (const dashboard of dashboards.splice(0)) await dashboard.close()
  for (const root of roots.splice(0)) cleanup(root)
})

function learner() {
  const workspace = makeWorkspace('first-byte-readiness-')
  roots.push(workspace.root)
  git(workspace.clone, ['remote', 'rename', 'origin', 'starter'])
  git(workspace.clone, ['remote', 'add', 'origin', workspace.participantRemote])
  git(workspace.clone, ['push', '-u', 'origin', 'main'])
  return workspace
}

function propose(clone, branch, value) {
  git(clone, ['switch', '-c', branch])
  writeIn(clone, SUMMARY, readIn(clone, SUMMARY).replace(/^- Final briefing sign-off:.*$/m, `- Final briefing sign-off: ${value}`))
  git(clone, ['commit', '-am', `Propose ${branch}`])
  git(clone, ['push', '-u', 'origin', branch])
}

const mission = (data, id) => data.progress.missions.find((row) => row.id === id)

async function apiFor(clone) {
  const dashboard = createDashboard({ repoRoot: clone, port: 0 })
  dashboards.push(dashboard)
  const address = await dashboard.listen()
  return async (path, body) => {
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, body ? {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    } : undefined)
    return { status: response.status, body: await response.json() }
  }
}

describe('student readiness regressions', () => {
  test('M3 exposes the question required to finish the mission', async () => {
    const workspace = learner()
    const data = await createEvaluator(workspace.clone).evaluate({})
    expect(mission(data, 'm3-local-finding').question?.id).toBe('diff-meaning')
  })

  test('M6 advances after both PRs are confirmed open, before either merge', async () => {
    const workspace = learner()
    const data = await createEvaluator(workspace.clone).evaluate({ confirmations: {
      'pr-lead-a': { url: 'https://github.com/learner/case/pull/1', openedAt: 'test' },
      'pr-lead-b': { url: 'https://github.com/learner/case/pull/2', openedAt: 'test' },
    } })
    expect(mission(data, 'm6-pull-requests').verified).toBe(true)
  })

  test('M5 rejects B branched directly from A', async () => {
    const workspace = learner()
    const baselineCommit = git(workspace.clone, ['rev-parse', 'HEAD']).trim()
    propose(workspace.clone, 'lead-a', A)
    propose(workspace.clone, 'lead-b', B)
    const data = await createEvaluator(workspace.clone).evaluate({ baselineCommit })
    expect(mission(data, 'm5-leads').verified).toBe(false)
  })

  test('M5 rejects edits elsewhere in the summary instead of competing line edits', async () => {
    const workspace = learner()
    const baselineCommit = git(workspace.clone, ['rev-parse', 'HEAD']).trim()
    for (const branch of ['lead-a', 'lead-b']) {
      git(workspace.clone, ['switch', 'main'])
      git(workspace.clone, ['switch', '-c', branch])
      writeIn(workspace.clone, SUMMARY, `${readIn(workspace.clone, SUMMARY)}\nAn unrelated ${branch} note.\n`)
      git(workspace.clone, ['commit', '-am', branch])
      git(workspace.clone, ['push', '-u', 'origin', branch])
    }
    const data = await createEvaluator(workspace.clone).evaluate({ baselineCommit })
    expect(mission(data, 'm5-leads').verified).toBe(false)
  })

  test('checkpoint capture rejects a nonexistent conflict', async () => {
    const workspace = learner()
    const api = await apiFor(workspace.clone)
    await api('/api/progress')
    const capture = await api('/api/checkpoint', { key: 'conflict' })
    expect(capture.status).toBe(409)
    const progress = await api('/api/progress')
    expect(progress.body.state.checkpoints.conflict).toBeUndefined()
    expect(mission(progress.body, 'm7-resolve').verified).toBe(false)
  })

  test('conflict capture records the real merge and does not accept the original proposal as a resolution', async () => {
    const workspace = learner()
    const api = await apiFor(workspace.clone)
    await api('/api/progress')
    propose(workspace.clone, 'lead-a', A)
    git(workspace.clone, ['switch', 'main'])
    propose(workspace.clone, 'lead-b', B)
    git(workspace.clone, ['switch', 'main'])
    git(workspace.clone, ['merge', '--no-ff', '-m', 'Merge A', 'lead-a'])
    git(workspace.clone, ['switch', 'lead-b'])
    expect(git(workspace.clone, ['merge', 'main'], { allowFail: true })).toBeNull()
    const capture = await api('/api/checkpoint', { key: 'conflict' })
    expect(capture.status).toBe(200)
    expect(capture.body.state.checkpoints.conflict.head).toBe(git(workspace.clone, ['rev-parse', 'HEAD']).trim())
    expect(capture.body.state.checkpoints.conflict.mergeHead).toBe(git(workspace.clone, ['rev-parse', 'MERGE_HEAD']).trim())
    git(workspace.clone, ['merge', '--abort'])
    const progress = await api('/api/progress')
    expect(mission(progress.body, 'm7-resolve').verified).toBe(false)
  })

  test('M8 rejects conflict markers retained in a committed final summary', async () => {
    const result = await runRehearsal()
    roots.push(result.root)
    writeIn(result.repository, SUMMARY, `${readIn(result.repository, SUMMARY)}\n<<<<<<< HEAD\n=======\n>>>>>>> main\n`)
    git(result.repository, ['commit', '-am', 'Mistaken resolution'])
    const data = await createEvaluator(result.repository).evaluate(result.steps.at(-1).progress.state)
    expect(mission(data, 'm8-finish').verified).toBe(false)
  }, 120_000)
})
