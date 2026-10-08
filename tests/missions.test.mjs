import { afterAll, describe, expect, test } from 'bun:test'
import { createEvaluator } from '../lib/missions.mjs'
import { cleanup, git, makeWorkspace, readIn, writeIn } from '../scripts/workspace.mjs'
import { runRehearsal } from '../scripts/rehearse.mjs'
import { FINDINGS, SUMMARY } from './fixtures.mjs'

describe('history fixture', () => {
  const workspace = makeWorkspace('first-byte-history-')
  afterAll(() => cleanup(workspace.root))

  test('a fresh clone carries the clue-bearing commits', () => {
    const log = git(workspace.clone, ['log', '--oneline'])
    expect(log).toContain('chore: open case FB-01')
    expect(log).toContain('chore: file the courier manifest')
    expect(log).toContain('docs: remove the sign-off line from the handover note')
    expect(log).toContain('chore: add the workshop app')
  })

  test('the sign-off detail is answerable from history alone', async () => {
    const clueCommit = git(workspace.clone, ['log', '--format=%H', '--grep=remove the sign-off line']).trim().split('\n')[0]
    const beforeRemoval = git(workspace.clone, ['show', `${clueCommit}^:activity/case/clues/handover-note.md`])
    const today = readIn(workspace.clone, 'activity/case/clues/handover-note.md')

    expect(beforeRemoval).not.toBe(today)
    expect(beforeRemoval).toMatch(/Final briefing sign-off: /)
    expect(today).not.toMatch(/Final briefing sign-off: signed/)

    const recovered = /Final briefing sign-off: (.+)/.exec(beforeRemoval)[1].trim()
    const evaluator = createEvaluator(workspace.clone)
    const answer = await evaluator.evaluate({ answers: { 'clue-signoff': { value: recovered } } })
    const mission = answer.progress.missions.find((row) => row.id === 'm2-inspect')

    expect(recovered).toContain('09:20')
    expect(mission.feedback).not.toContain('that is not the sign-off detail')
  })

  test('the courier manifest is a text file, not a puzzle', () => {
    const manifest = readIn(workspace.clone, 'activity/case/clues/courier-manifest.txt')
    expect(manifest).toMatch(/11:05/)
    expect(manifest).toMatch(/Silva/)
  })
})

describe('case files', () => {
  const workspace = makeWorkspace('first-byte-case-')
  afterAll(() => cleanup(workspace.root))

  test('both leads change the same designated line', () => {
    const summary = readIn(workspace.clone, SUMMARY)
    const lines = summary.split('\n').filter((row) => row.includes('Final briefing sign-off:'))
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('PENDING')
  })

  test('the app source is not a case file', () => {
    expect(SUMMARY.startsWith('activity/')).toBe(true)
    expect(FINDINGS.startsWith('activity/')).toBe(true)
  })
})

describe('dashboard against a temporary checkout', () => {
  const workspace = makeWorkspace('first-byte-dashboard-')
  const clone = workspace.clone
  const evaluator = createEvaluator(clone)
  afterAll(() => cleanup(workspace.root))

  // The dashboard records the baseline commit the first time it looks at the repository.
  const baseline = git(clone, ['rev-parse', 'HEAD']).trim()
  const progress = (extra = {}) => evaluator.evaluate({ baselineCommit: baseline, ...extra })
  const solved = (id) => progress().then((data) => data.progress.missions.find((row) => row.id === id).verified)

  test('reports every mission before anything is done', async () => {
    const data = await progress()
    expect(data.progress.total).toBe(9)
    expect(data.progress.missions.map((row) => row.id)).toEqual([
      'm0-arrive',
      'm1-publish',
      'm2-inspect',
      'm3-local-finding',
      'm4-save',
      'm5-leads',
      'm6-pull-requests',
      'm7-resolve',
      'm8-finish',
    ])
    expect(data.progress.solved).toBe(1)
    expect(data.progress.learnedConcepts).toContain('clone')
  })

  test('m1 stays unsolved until the baseline is on origin/main', async () => {
    expect(await solved('m1-publish')).toBe(false)

    git(clone, ['remote', 'rename', 'origin', 'starter'])
    git(clone, ['remote', 'add', 'origin', workspace.participantRemote])
    expect(await solved('m1-publish')).toBe(false)

    git(clone, ['push', '-u', 'origin', 'main'])
    expect(await solved('m1-publish')).toBe(true)
  })

  test('rejects a wrong sign-off answer without revealing it', async () => {
    const wrong = await progress({ answers: { 'clue-signoff': { value: 'a courier called Silva' } } })
    const mission = wrong.progress.missions.find((row) => row.id === 'm2-inspect')
    expect(mission.verified).toBe(false)
    expect(mission.feedback.toLowerCase()).toContain('not the sign-off detail')
    expect(mission.feedback).not.toContain('Perera')
    expect(mission.feedback).not.toContain('09:20')
  })

  test('m3 needs a case-file change and a correct diff answer', async () => {
    writeIn(clone, FINDINGS, '# Findings\n\nSign-off: 09:20 by N. Perera.\n')
    const wrongAnswer = await progress({ answers: { 'diff-meaning': { value: 'added' } } })
    expect(wrongAnswer.progress.missions.find((row) => row.id === 'm3-local-finding').verified).toBe(false)

    const rightAnswer = await progress({ answers: { 'diff-meaning': { value: 'removed' } } })
    expect(rightAnswer.progress.missions.find((row) => row.id === 'm3-local-finding').verified).toBe(true)
  })

  test('m4 requires the commit on origin/main and a captured staged diff', async () => {
    git(clone, ['add', FINDINGS])
    let data = await progress()
    expect(data.progress.missions.find((row) => row.id === 'm4-save').verified).toBe(false)

    git(clone, ['commit', '-m', 'Record first finding'])
    data = await progress()
    const stillMissing = data.progress.missions.find((row) => row.id === 'm4-save')
    expect(stillMissing.verified).toBe(false)
    expect(stillMissing.feedback).toContain('Check step')
    expect(stillMissing.feedback).toContain('not on `origin/main`')

    git(clone, ['push'])
    data = await progress({ checkpoints: { 'staged-diff': { at: 'test' } } })
    expect(data.progress.missions.find((row) => row.id === 'm4-save').verified).toBe(true)
  })
})

describe('conflict rehearsal in temporary repositories', () => {
  test('two leads from one base conflict after the first merge, and the resolution keeps both findings', async () => {
    const result = await runRehearsal()

    expect(result.conflicted).toBe(true)
    expect(result.unmerged).toBe(SUMMARY)
    expect(result.finalSummary).toContain('Perera')
    expect(result.finalSummary).toContain('Silva')
    expect(result.finalSummary).toMatch(/09:20/)
    expect(result.finalSummary).toMatch(/11:05/)
    expect(result.finalSummary).not.toContain('<<<<<<<')

    const last = result.steps.at(-1)
    for (const step of result.steps) expect(step.solved).toContain(step.expectation)
    expect(last.solved).toContain('m8-finish')
    expect(last.progress.progress.solved).toBe(9)
    expect(last.progress.progress.learnedConcepts).toContain('conflict-markers')

    cleanup(result.root)
  }, 120_000)

  test('a conflict on the designated line is real, not simulated', async () => {
    const workspace = makeWorkspace('first-byte-conflict-')
    afterAll(() => cleanup(workspace.root))

    git(workspace.clone, ['switch', '-c', 'lead-a'])
    writeIn(workspace.clone, SUMMARY, readIn(workspace.clone, SUMMARY).replace('PENDING', 'first answer'))
    git(workspace.clone, ['commit', '-am', 'lead a'])

    git(workspace.clone, ['switch', 'main'])
    git(workspace.clone, ['switch', '-c', 'lead-b'])
    writeIn(workspace.clone, SUMMARY, readIn(workspace.clone, SUMMARY).replace('PENDING', 'second answer'))
    git(workspace.clone, ['commit', '-am', 'lead b'])

    git(workspace.clone, ['switch', 'main'])
    git(workspace.clone, ['merge', '--no-ff', '-m', 'merge a', 'lead-a'])

    git(workspace.clone, ['switch', 'lead-b'])
    const merge = git(workspace.clone, ['merge', 'main'], { allowFail: true })
    expect(merge).toBe(null)
    expect(git(workspace.clone, ['diff', '--name-only', '--diff-filter=U']).trim()).toBe(SUMMARY)
    expect(readIn(workspace.clone, SUMMARY)).toContain('<<<<<<<')
  })
})
