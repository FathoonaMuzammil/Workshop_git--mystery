import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const SKIP = new Set(['node_modules', '.git', '.workshop-state', '.slidev', 'dist', 'first-byte-git-mystery'])
const SKIP_ANYWHERE = new Set(['SPEC.md', 'CONTEXT.md', '.DS_Store'])

export function git(cwd, args, { allowFail = false } = {}) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (error) {
    if (allowFail) return null
    const detail = error.stderr ? String(error.stderr).trim() : error.message
    throw new Error(`git ${args.join(' ')} failed in ${cwd}: ${detail}`)
  }
}

export function copySource(target) {
  cpSync(sourceRoot, target, {
    recursive: true,
    filter: (path) => {
      const name = path.split('/').pop()
      return !SKIP.has(name) && !SKIP_ANYWHERE.has(name)
    },
  })
  return target
}

export function tempDir(prefix = 'first-byte-') {
  return mkdtempSync(resolve(tmpdir(), prefix))
}

export function seedRepository(dir) {
  copySource(dir)
  const script = resolve(dir, 'scripts/seed-history.mjs')
  execFileSync(process.execPath, [script], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  return dir
}

/**
 * Build a learner's world in a temporary directory:
 * a seeded starter repository, a bare participant repository, and a clone.
 */
export function makeWorkspace(prefix = 'first-byte-') {
  const root = tempDir(prefix)
  const starter = resolve(root, 'starter-checkout')
  seedRepository(starter)

  const participantRemote = resolve(root, 'participant.git')
  git(root, ['init', '--bare', '--initial-branch=main', participantRemote])

  const clone = resolve(root, 'first-byte-git-mystery')
  git(root, ['clone', starter, clone])

  // A real learner must configure this too; tests do it so commits succeed.
  git(clone, ['config', 'user.name', 'Workshop Learner'])
  git(clone, ['config', 'user.email', 'learner@fb-01.invalid'])
  git(clone, ['config', 'commit.gpgsign', 'false'])

  return { root, starter, clone, participantRemote }
}

export function writeIn(dir, relative, content) {
  const path = resolve(dir, relative)
  writeFileSync(path, content)
  return path
}

export function readIn(dir, relative) {
  return readFileSync(resolve(dir, relative), 'utf8')
}

export function existsIn(dir, relative) {
  return existsSync(resolve(dir, relative))
}

export function cleanup(dir) {
  rmSync(dir, { recursive: true, force: true })
}