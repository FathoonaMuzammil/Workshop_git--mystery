#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const HANDOVER = 'activity/case/clues/handover-note.md'
const SIGNOFF_SUBJECT = 'docs: remove the sign-off line from the handover note'
const SIGNOFF_LINE = '> Final briefing sign-off: signed at 09:20 by Deputy Archivist N. Perera.\n\n'

function git(args, { allowFail = false } = {}) {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (error) {
    if (allowFail) return null
    const detail = error.stderr ? String(error.stderr).trim() : error.message
    process.stderr.write(`git ${args.join(' ')} failed: ${detail}\n`)
    process.exit(1)
  }
}

function commit(args) {
  return git(['-c', 'commit.gpgsign=false', 'commit', ...args])
}

/**
 * The case is fiction; the commit author is whoever prepared the repository.
 * This script must never write a repository-local identity, or a published
 * starter repository gets attributed to the case fiction instead of its author.
 */
function requireIdentity() {
  const name = git(['config', '--get', 'user.name'], { allowFail: true })
  const email = git(['config', '--get', 'user.email'], { allowFail: true })
  if (!name?.trim() || !email?.trim()) {
    process.stderr.write(
      'Git has no author identity configured, so the case history cannot be written.\n' +
        'Set one, then run this again:\n' +
        '  git config --global user.name "Your Name"\n' +
        '  git config --global user.email you@example.com\n',
    )
    process.exit(1)
  }
}

function writeHandover(content) {
  const path = resolve(repoRoot, HANDOVER)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

function main() {
  if (git(['rev-parse', '--verify', '--quiet', 'HEAD'], { allowFail: true }) !== null) {
    process.stderr.write('This repository already has commits. Run the seed on a fresh clone.\n')
    process.exit(1)
  }

  requireIdentity()
  git(['init', '--initial-branch=main'])
  git(['config', 'commit.gpgsign', 'false'])

  // 1. The case opens. The handover note still carries the sign-off line.
  writeHandover(`# Archive handover note

**Filed:** 9 October, Heliograph launch records
**Filed by:** Records desk

${SIGNOFF_LINE}The morning briefing was signed off before launch and the signed copy was handed to the
courier desk for onward delivery.
`)
  git(['add', '.gitignore', 'activity/case/summary.md', 'activity/case/findings.md', HANDOVER])
  commit([
    '-m',
    'chore: open case FB-01, the missing final briefing',
    '-m',
    'The records desk opens the case. The morning briefing for the Heliograph launch was\nfiled and cannot be found. The archive handover note carries the sign-off line for now.',
  ])

  // 2. The courier manifest arrives with the sealed copy.
  git(['add', 'activity/case/clues/courier-manifest.txt'])
  commit([
    '-m',
    'chore: file the courier manifest for the sealed briefing copy',
    '-m',
    'The sealed copy travelled with a courier. The manifest records the route, the delivery\ntime, and who signed for it at the gate.',
  ])

  // 3. The sign-off line is removed from the note, so it survives only in history.
  writeHandover(readFileSync(resolve(repoRoot, HANDOVER), 'utf8').replace(SIGNOFF_LINE, ''))
  git(['add', HANDOVER])
  commit([
    '-m',
    SIGNOFF_SUBJECT,
    '-m',
    'Filing removed the sign-off line from the handover note and replaced it with a pointer.\nThe line is not lost: the version that carried it is preserved in this commit.\nRun `git show` on this commit to read it.',
  ])

  // 4. The workshop app arrives on top of the case.
  git(['add', '-A'])
  commit([
    '-m',
    'chore: add the workshop app, concept slides, and progress dashboard',
    '-m',
    'Adds the local workshop app used during the session. It does not touch the case files.',
  ])

  const log = git(['log', '--oneline']).trim()
  process.stdout.write(`Seeded case history in ${repoRoot}\n\n${log}\n\n`)
  process.stdout.write(`Clue lives in: git show <commit for "${SIGNOFF_SUBJECT}">\n`)
}

main()