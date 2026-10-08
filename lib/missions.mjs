import { readFileSync } from 'node:fs'
import { GUIDE_BASE, LEADS, REPO_PATHS } from '../config.mjs'
import { createGit } from './git.mjs'

export const MISSION_IDS = [
  'm0-arrive',
  'm1-publish',
  'm2-inspect',
  'm3-local-finding',
  'm4-save',
  'm5-leads',
  'm6-pull-requests',
  'm7-resolve',
  'm8-finish',
]

const SUMMARY_LINE_PREFIX = '- Final briefing sign-off:'
const CLUE_A = { name: 'Perera', time: '09:20' }
const CLUE_B = { name: 'Silva', time: '11:05' }

function normalize(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function checkClueA(text) {
  const value = normalize(text)
  return value.includes('perera') && /0?9:?20/.test(value)
}

export function checkClueB(text) {
  const value = normalize(text)
  return value.includes('silva') && /11:?05/.test(value)
}

export function summaryFindings(summaryText) {
  const line = String(summaryText ?? '')
    .split('\n')
    .find((row) => row.trim().startsWith(SUMMARY_LINE_PREFIX))
  if (!line) return { line: null, a: false, b: false, pending: false }
  const value = line.slice(line.indexOf(':') + 1)
  return {
    line: value.trim(),
    a: checkClueA(value),
    b: checkClueB(value),
    pending: /pending/i.test(value),
  }
}

const DIFF_QUESTION = {
  id: 'diff-meaning',
  prompt: 'In a diff, what does a line starting with `-` tell you?',
  choices: [
    { value: 'removed', label: 'It was removed from the file', correct: true },
    { value: 'added', label: 'It was added to the file', correct: false },
    { value: 'command', label: 'It is the command that produced the diff', correct: false },
  ],
}

const RECALL_QUESTION = {
  id: 'push-recall',
  prompt: 'You have an unstaged change to one case file. What is the order to get it onto GitHub?',
  choices: [
    { value: 'diff-add-commit-push', label: 'diff → add → commit → push', correct: true },
    { value: 'add-diff-commit-push', label: 'add → diff → commit → push', correct: false },
    { value: 'commit-diff-add-push', label: 'commit → diff → add → push', correct: false },
  ],
}

const QUESTIONS = { [DIFF_QUESTION.id]: DIFF_QUESTION, [RECALL_QUESTION.id]: RECALL_QUESTION }

function answerIsCorrect(questionId, answer) {
  const question = QUESTIONS[questionId]
  if (!question) return false
  return question.choices.some((choice) => choice.value === answer && choice.correct)
}

export function createEvaluator(repoRoot) {
  const git = createGit(repoRoot)

  function readCaseFile(relative) {
    try {
      return readFileSync(`${repoRoot}/${relative}`, 'utf8')
    } catch {
      return ''
    }
  }

  async function snapshot(state) {
    const [head, branch, status, remotes, localBranches, remoteBranches, unmerged] = await Promise.all([
      git.revParse('HEAD'),
      git.currentBranch(),
      git.status(),
      git.remotes(),
      git.localBranches(),
      git.remoteBranches(),
      git.unmergedPaths(),
    ])

    const unstaged = status ? status.files.filter((file) => file.index === ' ' && file.worktree !== ' ') : []
    const staged = status ? status.files.filter((file) => file.index !== ' ' && file.index !== '?') : []
    const untracked = status ? status.files.filter((file) => file.index === '?') : []

    const base = state.baselineCommit ?? head

    return {
      head,
      base,
      branch,
      status,
      remotes,
      localBranches,
      remoteBranches,
      unmerged,
      unstaged,
      staged,
      untracked,
      remoteByName: Object.fromEntries(remotes.map((remote) => [remote.name, remote])),
    }
  }

  async function evaluate(rawState) {
    const state = {
      baselineCommit: rawState?.baselineCommit ?? null,
      answers: rawState?.answers ?? {},
      confirmations: rawState?.confirmations ?? {},
      checkpoints: rawState?.checkpoints ?? {},
    }
    const snap = await snapshot(state)
    const missions = []

    const repoOk = await git.isRepository()

    missions.push({
      id: 'm0-arrive',
      title: 'Arrive and launch',
      verified: repoOk,
      kind: 'verified',
      steps: [
        'Clone the starter repository and run `bun install` once.',
        'Run `bun run start` from the repository root.',
        'Confirm the slides are on port 3030 and the dashboard is on port 3031.',
      ],
      checkpoint: 'Both local pages respond and the dashboard found this checkout.',
      feedback: repoOk
        ? 'Checkout detected. Both pages are live.'
        : 'No Git repository found here. Re-clone the starter repository, then run `bun install` and `bun run start`.',
      concepts: ['clone', 'local-repository', 'terminal'],
      guide: `${GUIDE_BASE}#m0-arrive-and-launch`,
    })

    const starterRemote = snap.remoteByName.starter
    const originRemote = snap.remoteByName.origin
    const remoteMain = snap.head ? await git.revParse('refs/remotes/origin/main') : null
    const distinctUrls = Boolean(starterRemote && originRemote && starterRemote.urls[0] !== originRemote.urls[0])
    const baselinePublished =
      snap.base && remoteMain ? await git.isAncestor(snap.base, 'refs/remotes/origin/main') : false
    const publishOk = Boolean(repoOk && starterRemote && originRemote && remoteMain && distinctUrls && baselinePublished)
    const remoteNames = snap.remotes.map((remote) => remote.name)

    missions.push({
      id: 'm1-publish',
      title: 'Publish a baseline',
      verified: publishOk,
      kind: 'verified',
      steps: [
        'Create a **new empty** participant repository on GitHub. Do not add a README, license, or ignore file.',
        'Rename the existing remote: `git remote rename origin starter`.',
        'Add your own repository: `git remote add origin <your-repository-url>`.',
        'Check with `git remote -v`, then publish: `git push -u origin main`.',
      ],
      checkpoint: 'Two remotes named `starter` and `origin`, with your baseline published on `origin/main`.',
      feedback: publishFeedback({ repoOk, remoteNames, starterRemote, originRemote, remoteMain, baselinePublished }),
      concepts: ['remote', 'local-vs-github', 'push-u'],
      guide: `${GUIDE_BASE}#m1-publish-a-baseline`,
    })

    const answerA = state.answers['clue-signoff']
    const clueOk = checkClueA(answerA?.value)
    const treeClean = snap.unstaged.length === 0 && snap.staged.length === 0 && snap.untracked.length === 0
    const cleanObserved = treeClean || Boolean(state.checkpoints['clean-tree'])
    const inspectOk = clueOk && cleanObserved && repoOk

    missions.push({
      id: 'm2-inspect',
      title: 'Inspect the case',
      verified: inspectOk,
      kind: 'verified',
      steps: [
        'Read the files in `activity/case`.',
        'Run `git status` and confirm your working tree is clean.',
        'Run `git log --oneline` and look for a commit about the archive handover.',
        'Run `git show <that-commit>` and read the whole commit, not only its subject.',
        'Record who signed off the final briefing and at what time.',
      ],
      checkpoint: 'Correct sign-off detail recorded, and a clean working tree observed.',
      feedback: inspectFeedback({ answerA, clueOk, cleanObserved }),
      freeAnswer: {
        id: 'clue-signoff',
        prompt: 'Who signed off the final briefing, and at what time? (Two clues in one field.)',
      },
      concepts: ['status', 'log', 'show', 'history'],
      guide: `${GUIDE_BASE}#m2-inspect-the-case`,
    })

    const findingsChanged = snap.unstaged.some((file) => file.path === REPO_PATHS.findings)
    const unstagedObserved = findingsChanged || Boolean(state.checkpoints['unstaged-finding'])
    const diffAnswer = state.answers[DIFF_QUESTION.id]
    const localFindingOk = repoOk && unstagedObserved && answerIsCorrect(DIFF_QUESTION.id, diffAnswer?.value)

    missions.push({
      id: 'm3-local-finding',
      title: 'Make a local finding',
      verified: localFindingOk,
      kind: 'verified',
      steps: [
        `Edit \`${REPO_PATHS.findings}\` and write down your first finding from the history clue.`,
        'Run `git status` and find the modified file.',
        'Run `git diff` and read every `-` and `+` line.',
        'Use **Check step** to capture the diff before you continue.',
        'Answer the short question about what the diff shows.',
      ],
      checkpoint: `An unstaged change in \`${REPO_PATHS.findings}\` observed, and a correct read of the diff.`,
      feedback: localFindingFeedback({ unstagedObserved, diffAnswer }),
      concepts: ['working-tree', 'status', 'diff'],
      guide: `${GUIDE_BASE}#m3-make-a-local-finding`,
    })

    const findingCommits = snap.head && snap.base ? await git.commitsTouching(REPO_PATHS.findings, `${snap.base}..${snap.head}`) : []
    const stagedCaptured = Boolean(state.checkpoints['staged-diff'])
    const findingPushed =
      remoteMain && findingCommits.length > 0
        ? (await Promise.all(findingCommits.map((sha) => git.isAncestor(sha, 'refs/remotes/origin/main')))).some(Boolean)
        : false
    const saveOk = repoOk && findingCommits.length > 0 && findingPushed && stagedCaptured

    missions.push({
      id: 'm4-save',
      title: 'Save the finding',
      verified: saveOk,
      kind: 'verified',
      steps: [
        `Stage only your case file: \`git add ${REPO_PATHS.findings}\`.`,
        'Inspect the staged snapshot with `git diff --staged`.',
        'Use **Check step** to capture the staged diff while it is visible.',
        'Commit: `git commit -m "Record first finding"`.',
        'Confirm with `git log --oneline`, then push: `git push`.',
      ],
      checkpoint: 'A commit containing your finding, published on `origin/main`, and a captured staged diff.',
      feedback: saveFeedback({ findingCommits, findingPushed, stagedCaptured, branch: snap.branch }),
      concepts: ['staging', 'staged-diff', 'commit'],
      guide: `${GUIDE_BASE}#m4-save-the-finding`,
    })

    const leadInfo = await Promise.all(
      LEADS.map(async (lead) => {
        const local = snap.localBranches.includes(lead)
        const tip = local ? await git.revParse(`refs/heads/${lead}`) : null
        const remoteTip = local ? await git.revParse(`refs/remotes/origin/${lead}`) : null
        const base = local ? await git.mergeBase(lead, snap.base ?? 'HEAD') : null
        const touchesSummary = local
          ? (await git.commitFiles(`${snap.base ?? 'HEAD'}..${lead}`)).includes(REPO_PATHS.summary)
          : false
        return { lead, local, tip, remoteTip, pushed: Boolean(tip && remoteTip && tip === remoteTip), base, touchesSummary }
      }),
    )

    const bothLeadsLocal = leadInfo.every((info) => info.local)
    const bothPushed = leadInfo.every((info) => info.pushed)
    const sameBase = bothLeadsLocal && leadInfo[0].base !== null && leadInfo[0].base === leadInfo[1].base
    const bothEditedLine = leadInfo.every((info) => info.touchesSummary)
    const leadsOk = repoOk && bothLeadsLocal && bothPushed && sameBase && bothEditedLine

    missions.push({
      id: 'm5-leads',
      title: 'Prepare two leads',
      verified: leadsOk,
      kind: 'verified',
      steps: [
        'Stay on `main` and make sure it is pushed and up to date.',
        'Create lead A: `git switch -c lead-a`.',
        `Edit the \`${SUMMARY_LINE_PREFIX}\` line in \`${REPO_PATHS.summary}\` using the history clue, then stage, commit, and push \`lead-a\`.`,
        'Switch back to `main`, then create lead B: `git switch -c lead-b`.',
        `Edit the same line in \`${REPO_PATHS.summary}\` using the courier manifest clue, then stage, commit, and push \`lead-b\`.`,
      ],
      checkpoint: 'Both leads exist locally and remotely, start from the same commit, and change the designated summary line.',
      feedback: leadsFeedback({ leadInfo, bothLeadsLocal, bothPushed, sameBase, bothEditedLine }),
      concepts: ['branch', 'switch-c', 'competing-branches'],
      guide: `${GUIDE_BASE}#m5-prepare-two-leads`,
    })

    const confirmations = state.confirmations
    const prA = confirmations['pr-lead-a']
    const prB = confirmations['pr-lead-b']
    const urlOk = (entry) => typeof entry?.url === 'string' && /^https:\/\/[^ ]+$/.test(entry.url.trim())
    const prsOk = urlOk(prA) && urlOk(prB) && Boolean(prA?.mergedAt) && Boolean(prB?.openedAt)

    missions.push({
      id: 'm6-pull-requests',
      title: 'Open two pull requests',
      verified: prsOk,
      kind: 'self-confirmed',
      steps: [
        'On GitHub, open a pull request from `lead-a` into `main`.',
        'Review its diff, record the link, and confirm the pull request is open.',
        'Open a second pull request from `lead-b` into `main`.',
        'Review its diff and record the link too. Keep both pull requests open.',
      ],
      checkpoint: 'Two open pull requests against your own `main`, both links recorded.',
      feedback: prsFeedback({ prA, prB, urlOk, mergedA: Boolean(prA?.mergedAt) }),
      confirmation: {
        id: 'prs',
        items: [
          { key: 'pr-lead-a', label: 'lead-a pull request link' },
          { key: 'pr-lead-b', label: 'lead-b pull request link' },
        ],
      },
      concepts: ['pull-request', 'base-vs-compare', 'review'],
      guide: `${GUIDE_BASE}#m6-open-two-pull-requests`,
    })

    const conflictCaptured = Boolean(state.checkpoints.conflict)
    const leadATip = leadInfo[0].tip
    const leadAInMain = leadATip ? await git.isAncestor(leadATip, 'main') : false
    const leadBPushed = leadInfo[1].pushed
    const noUnmerged = snap.unmerged.length === 0
    const resolutionCommitted = Boolean(
      leadInfo[1].tip && leadInfo[1].base && leadInfo[1].tip !== leadInfo[1].base,
    )
    const resolveOk = repoOk && leadAInMain && leadBPushed && noUnmerged && resolutionCommitted && conflictCaptured

    missions.push({
      id: 'm7-resolve',
      title: 'Encounter and resolve',
      verified: resolveOk,
      kind: 'verified',
      steps: [
        'Merge the `lead-a` pull request on GitHub.',
        'Bring it down: `git switch main && git pull`.',
        `Bring main into lead B: \`git switch lead-b && git merge main\` and expect conflict markers in \`${REPO_PATHS.summary}\`.`,
        'Use **Check step** to capture the conflicted file while the markers are still there.',
        'Re-read both clues, then rewrite the line so it carries both supported facts. Delete every `<<<<<<<`, `=======`, and `>>>>>>>` marker.',
        'Run `git status` until no unmerged paths remain, then `git add` and `git commit`.',
        'Push: `git push`.',
      ],
      checkpoint: '`main` contains lead A, lead B has a resolution commit, no unmerged paths remain, and lead B is pushed.',
      feedback: resolveFeedback({
        leadAInMain,
        leadBPushed,
        noUnmerged,
        resolutionCommitted,
        conflictCaptured,
        unmerged: snap.unmerged,
      }),
      concepts: ['pull', 'merge', 'conflict-markers', 'resolution-commit'],
      guide: `${GUIDE_BASE}#m7-encounter-and-resolve`,
    })

    const recall = state.answers[RECALL_QUESTION.id]
    const recallOk = answerIsCorrect(RECALL_QUESTION.id, recall?.value)
    const finished = await git.revParse('main')
    const leadBInMain = leadInfo[1].tip && finished ? await git.isAncestor(leadInfo[1].tip, finished) : false
    const summary = summaryFindings(readCaseFile(REPO_PATHS.summary))
    const caseComplete = summary.a && summary.b && !summary.pending
    const finishOk = repoOk && leadBInMain && caseComplete && recallOk

    missions.push({
      id: 'm8-finish',
      title: 'Finish and retrieve',
      verified: finishOk,
      kind: 'verified',
      steps: [
        'Merge the `lead-b` pull request on GitHub.',
        'Inspect the final story: `git log --oneline --graph`.',
        'Confirm the case summary carries both supported findings.',
        'Answer the recall question and read back your learned concepts.',
      ],
      checkpoint: 'Both findings present in the case summary, both leads merged, and the recall question answered.',
      feedback: finishFeedback({ leadBInMain, caseComplete, recallOk, summary }),
      question: RECALL_QUESTION,
      concepts: ['history-review', 'workflow-recall'],
      guide: `${GUIDE_BASE}#m8-finish-and-retrieve`,
    })

    const learned = []
    for (const mission of missions) {
      if (!mission.verified) continue
      for (const concept of mission.concepts) {
        if (!learned.includes(concept)) learned.push(concept)
      }
    }

    const current = missions.find((mission) => !mission.verified) ?? null
    const solvedCount = missions.filter((mission) => mission.verified).length

    return {
      guideRoot: GUIDE_BASE,
      repository: {
        root: repoRoot,
        isRepository: repoOk,
        branch: snap.branch,
        head: snap.head,
        baseline: snap.base,
        remotes: snap.remotes,
        localBranches: snap.localBranches,
        remoteBranches: snap.remoteBranches,
        unmerged: snap.unmerged,
        dirty: {
          unstaged: snap.unstaged.map((file) => file.path),
          staged: snap.staged.map((file) => file.path),
          untracked: snap.untracked.map((file) => file.path),
        },
      },
      progress: {
        total: missions.length,
        solved: solvedCount,
        currentMissionId: current ? current.id : null,
        missions,
        learnedConcepts: learned,
      },
      state,
    }
  }

  return { evaluate, snapshot, git, readCaseFile: (relative) => readCaseFile(relative) }
}


function publishFeedback({ repoOk, remoteNames, starterRemote, originRemote, remoteMain, baselinePublished }) {
  if (!repoOk) return 'Start from a clone of the starter repository.'
  if (!starterRemote) return 'Rename your existing remote to `starter`: `git remote rename origin starter`.'
  if (!originRemote) return 'Add your participant repository: `git remote add origin <your-repository-url>`.'
  if (starterRemote.urls[0] === originRemote.urls[0]) {
    return 'Both remotes point at the same repository. `starter` must stay the workshop repository and `origin` must be yours.'
  }
  if (!remoteMain) return 'Push the baseline: `git push -u origin main`.'
  if (!baselinePublished) {
    return 'Your baseline is not on `origin/main` yet. Run `git push -u origin main`.'
  }
  return `Remotes look right (${remoteNames.join(', ')}) and your baseline is published on \`origin/main\`.`
}

function inspectFeedback({ answerA, clueOk, cleanObserved }) {
  const parts = []
  parts.push(
    clueOk
      ? 'Sign-off detail recorded correctly.'
      : answerA
        ? 'That is not the sign-off detail yet. The value is only in an earlier version of the archive handover note — find the commit that changed it and read the whole commit.'
        : 'No answer recorded yet.',
  )
  parts.push(cleanObserved ? 'A clean working tree was observed.' : 'Your working tree is not clean. Commit or restore stray edits before continuing.')
  return parts.join(' ')
}

function localFindingFeedback({ unstagedObserved, diffAnswer }) {
  const parts = []
  parts.push(unstagedObserved ? 'An unstaged change in your case file was observed.' : `No unstaged change in \`${REPO_PATHS.findings}\` yet. Edit it, then run \`git diff\`.`)
  parts.push(answerIsCorrect('diff-meaning', diffAnswer?.value) ? 'Diff question answered correctly.' : 'Answer the diff question to finish this mission.')
  return parts.join(' ')
}

function saveFeedback({ findingCommits, findingPushed, stagedCaptured, branch }) {
  const parts = []
  parts.push(findingCommits.length > 0 ? 'A commit touching your case file exists.' : 'No commit touching your case file yet.')
  parts.push(findingPushed ? 'That commit is published on `origin/main`.' : 'That commit is not on `origin/main` yet. Run `git push`.')
  parts.push(stagedCaptured ? 'Staged diff captured.' : 'Use **Check step** while the staged diff is on screen.')
  if (branch && branch !== 'main') parts.push(`You are on \`${branch}\`. This mission expects work on \`main\`.`)
  return parts.join(' ')
}

function leadsFeedback({ leadInfo, bothLeadsLocal, bothPushed, sameBase, bothEditedLine }) {
  const parts = []
  parts.push(bothLeadsLocal ? 'Both lead branches exist locally.' : 'Both lead branches must exist locally.')
  parts.push(sameBase ? 'Both leads start from the same commit.' : 'Both leads must be created from the same unchanged `main` commit.')
  parts.push(bothEditedLine ? 'Both leads change the designated summary line.' : 'Each lead must change the designated summary line.')
  parts.push(bothPushed ? 'Both leads are pushed.' : `Push each lead. Missing: ${leadInfo.filter((info) => !info.pushed).map((info) => info.lead).join(', ') || 'none detected'}.`)
  return parts.join(' ')
}

function prsFeedback({ prA, prB, urlOk, mergedA }) {
  const parts = []
  parts.push(urlOk(prA) ? 'lead-a pull request link recorded.' : 'Record the lead-a pull request link.')
  parts.push(urlOk(prB) ? 'lead-b pull request link recorded.' : 'Record the lead-b pull request link.')
  parts.push(mergedA ? 'You marked lead-a as merged.' : 'Mark lead-a as merged only after you actually merge it on GitHub.')
  return `${parts.join(' ')} GitHub actions are self-confirmed, not verified by the app.`
}

function resolveFeedback({ leadAInMain, leadBPushed, noUnmerged, resolutionCommitted, conflictCaptured, unmerged }) {
  const parts = []
  parts.push(leadAInMain ? '`main` contains lead A.' : 'Merge pull request A, then `git switch main && git pull`.')
  parts.push(resolutionCommitted ? 'lead B has commits beyond its starting point.' : 'lead B still has no resolution commit.')
  parts.push(
    noUnmerged
      ? 'No unmerged paths remain.'
      : `Unmerged paths still present: ${unmerged.join(', ')}. Resolve every marker, then \`git add\` the file.`,
  )
  parts.push(leadBPushed ? 'lead B is pushed.' : 'Push your resolution: `git push`.')
  parts.push(conflictCaptured ? 'Conflict captured.' : 'Use **Check step** while the conflict markers are still on screen.')
  return parts.join(' ')
}

function finishFeedback({ leadBInMain, caseComplete, recallOk, summary }) {
  const parts = []
  parts.push(leadBInMain ? '`main` contains lead B.' : 'Merge pull request B on GitHub.')
  parts.push(caseComplete ? 'The case summary carries both supported findings.' : 'The case summary is still missing one of the supported findings.')
  if (summary.line && !caseComplete) parts.push(`Current sign-off line reads: "${summary.line}".`)
  parts.push(recallOk ? 'Recall question answered correctly.' : 'Answer the recall question.')
  return parts.join(' ')
}