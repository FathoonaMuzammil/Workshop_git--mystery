#!/usr/bin/env node
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LEADS, REPO_PATHS } from '../config.mjs'
import { createEvaluator } from '../lib/missions.mjs'
import { createObserver } from '../lib/observe.mjs'
import { createStateStore } from '../lib/state.mjs'
import { captureCheckpoint } from '../lib/checkpoints.mjs'
import { cleanup, git, makeWorkspace, readIn, writeIn } from './workspace.mjs'

const [LEAD_A, LEAD_B] = LEADS
const SUMMARY = REPO_PATHS.summary
const FINDINGS = REPO_PATHS.findings
const SIGN_OFF_LINE = 'Final briefing sign-off:'

export function summaryLine(text) {
  return text.split('\n').find((row) => row.includes(SIGN_OFF_LINE))
}

function setSummaryLine(dir, value) {
  const current = readIn(dir, SUMMARY)
  if (current.includes('<<<<<<<')) {
    writeIn(dir, SUMMARY, current.replace(/^<<<<<<<[^\n]*\n[\s\S]*?^>>>>>>>[^\n]*/m, `- ${SIGN_OFF_LINE} ${value}`))
    return
  }
  const lines = current.split('\n')
  const index = lines.findIndex((row) => row.includes(SIGN_OFF_LINE))
  if (index === -1) throw new Error(`designated line missing from ${SUMMARY}`)
  lines[index] = `- ${SIGN_OFF_LINE} ${value}`
  writeIn(dir, SUMMARY, lines.join('\n'))
}

/** GitHub's side of the two pull requests, simulated with plain local Git. */
function githubMergePullRequest(clone, branch, pullRequestNumber) {
  git(clone, ['switch', 'main'])
  git(clone, ['merge', '--no-ff', '-m', `Merge pull request #${pullRequestNumber} from ${branch}`, branch])
  git(clone, ['push', 'origin', 'main'])
}

/**
 * Drive every mission with real Git commands and report the dashboard's
 * view at each step. Used by `bun run rehearse` and by the rehearsal test.
 */
export async function runRehearsal({ prefix = 'first-byte-rehearsal-' } = {}) {
  const workspace = makeWorkspace(prefix)
  const { clone, participantRemote } = workspace
  const evaluator = createEvaluator(clone)
  const store = createStateStore(clone)
  const observe = createObserver({ git: evaluator.git, store })
  const steps = []

  const record = async (label, expectation) => {
    const current = store.read()
    if (!current.baselineCommit) {
      const head = await evaluator.git.revParse('HEAD')
      store.write({ ...current, baselineCommit: head })
    }
    const progress = await evaluator.evaluate(await observe(store.read()))
    const solved = progress.progress.missions.filter((mission) => mission.verified).map((mission) => mission.id)
    steps.push({ label, expectation, solved, progress })
    return progress
  }

  try {
    // Phase 0 — clone, install, launch.
    await record('clone and launch', 'm0-arrive')

    // Phase 1 — publish the baseline.
    git(clone, ['remote', 'rename', 'origin', 'starter'])
    git(clone, ['remote', 'add', 'origin', participantRemote])
    git(clone, ['push', '-u', 'origin', 'main'])
    await record('publish baseline', 'm1-publish')

    // Phase 2 — inspect the case. The clue lives only in the commit that removed it.
    const clueCommit = git(clone, ['log', '--pretty=format:%h %s', '--', 'activity/case/clues/handover-note.md'])
      .split('\n')
      .map((row) => row.trim())
      .filter((row) => /remove the sign-off line/.test(row))[0]
      .split(' ')[0]
    const signoffFromHistory = git(clone, ['show', `${clueCommit}^:activity/case/clues/handover-note.md`])
    const recovered = /Final briefing sign-off: (.+)/.exec(signoffFromHistory)[1].trim()

    const answerState = { ...store.read(), answers: { 'clue-signoff': { value: recovered } } }
    store.write(answerState)
    await record('recover sign-off from history', 'm2-inspect')

    // Phase 3 — a local finding, still unstaged.
    writeIn(
      clone,
      FINDINGS,
      `# Findings\n\n## Finding 1 — from the repository history\n\n${recovered}\n\nRecovered from commit ${clueCommit}.\n`,
    )
    store.write({ ...store.read(), answers: { ...store.read().answers, 'diff-meaning': { value: 'removed' } } })
    await record('unstaged finding plus diff question', 'm3-local-finding')

    // Phase 4 — stage, capture, commit, push.
    git(clone, ['add', FINDINGS])
    store.write({ ...store.read(), checkpoints: { ...store.read().checkpoints, 'staged-diff': await captureCheckpoint(evaluator.git, 'staged-diff') } })
    await record('staged diff captured', 'm3-local-finding')

    git(clone, ['commit', '-m', 'Record first finding'])
    git(clone, ['push'])
    await record('first finding committed and pushed', 'm4-save')

    // Phase 5 — two leads from the same pushed main.
    git(clone, ['switch', '-c', LEAD_A])
    setSummaryLine(clone, recovered)
    git(clone, ['add', SUMMARY])
    git(clone, ['commit', '-m', 'Lead A: sign-off from the archive handover note'])
    git(clone, ['push', '-u', 'origin', LEAD_A])

    git(clone, ['switch', 'main'])
    git(clone, ['switch', '-c', LEAD_B])
    setSummaryLine(clone, 'sealed copy received at 11:05 at Gate C by Desk Officer S. Silva')
    git(clone, ['add', SUMMARY])
    git(clone, ['commit', '-m', 'Lead B: sealed copy receipt from the courier manifest'])
    git(clone, ['push', '-u', 'origin', LEAD_B])
    await record('two leads pushed from the same base', 'm5-leads')

    // Phase 6 — self-confirm the two pull requests.
    store.write({
      ...store.read(),
      confirmations: {
        'pr-lead-a': { url: 'https://github.com/learner/case-fb01/pull/1', openedAt: 'rehearsal' },
        'pr-lead-b': { url: 'https://github.com/learner/case-fb01/pull/2', openedAt: 'rehearsal' },
      },
    })
    await record('two pull requests recorded', 'm6-pull-requests')

    // Phase 7 — merge pull request A, then pull it down.
    githubMergePullRequest(clone, LEAD_A, 1)
    store.write({ ...store.read(), confirmations: { ...store.read().confirmations, 'pr-lead-a': { ...store.read().confirmations['pr-lead-a'], mergedAt: 'rehearsal' } } })

    git(clone, ['switch', 'main'])
    git(clone, ['pull'])

    git(clone, ['switch', LEAD_B])
    const mergeOutput = git(clone, ['merge', 'main'], { allowFail: true })
    const conflicted = mergeOutput === null
    const unmerged = git(clone, ['diff', '--name-only', '--diff-filter=U']).trim()
    store.write({ ...store.read(), checkpoints: { ...store.read().checkpoints, conflict: await captureCheckpoint(evaluator.git, 'conflict') } })

    // The reasoned resolution: keep both supported facts on the one line.
    setSummaryLine(clone, `${recovered}; sealed copy received at 11:05 at Gate C by Desk Officer S. Silva`)
    git(clone, ['add', SUMMARY])
    git(clone, ['commit', '-m', 'Resolve: final briefing signed off and sealed copy received'])
    git(clone, ['push'])
    await record('conflict resolved locally and pushed', 'm7-resolve')

    // Phase 8 — merge pull request B and answer the recall question.
    githubMergePullRequest(clone, LEAD_B, 2)
    store.write({
      ...store.read(),
      answers: { ...store.read().answers, 'push-recall': { value: 'diff-add-commit-push' } },
    })
    const final = await record('second pull request merged', 'm8-finish')
    for (const mission of final.progress.missions.filter((row) => !row.verified)) {
      process.stderr.write(`unresolved ${mission.id}: ${mission.feedback}\n`)
    }

    return {
      root: workspace.root,
      steps,
      conflicted,
      unmerged,
      recovered,
      finalSummary: summaryLine(readIn(clone, SUMMARY)),
      repository: clone,
    }
  } catch (error) {
    cleanup(workspace.root)
    throw error
  }
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  const result = await runRehearsal()
  for (const step of result.steps) {
    process.stdout.write(`${step.solved.includes(step.expectation) ? 'ok  ' : 'MISS'} ${step.label} — solved: ${step.solved.join(', ') || 'none'}\n`)
  }
  process.stdout.write(`\nconflict produced: ${result.conflicted} on ${result.unmerged || 'no path'}\n`)
  process.stdout.write(`final summary line: ${result.finalSummary}\n`)
  process.stdout.write(`\nWorkspace kept for inspection: ${result.repository}\n`)
}
