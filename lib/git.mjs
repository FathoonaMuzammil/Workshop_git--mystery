import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

const MAX_BUFFER = 2 * 1024 * 1024

export class GitError extends Error {
  constructor(args, error) {
    super(`git ${args.join(' ')} failed`)
    this.args = args
    this.exitCode = error?.code ?? null
  }
}

export function createGit(repoRoot) {
  async function git(args) {
    try {
      const { stdout } = await run('git', args, {
        cwd: repoRoot,
        maxBuffer: MAX_BUFFER,
        encoding: 'utf8',
        windowsHide: true,
      })
      return stdout
    } catch (error) {
      throw new GitError(args, error)
    }
  }

  async function attempt(args) {
    try {
      return await git(args)
    } catch {
      return null
    }
  }

  return {
    repoRoot,

    async isRepository() {
      return (await attempt(['rev-parse', '--git-dir'])) !== null
    },

    async revParse(ref) {
      const out = await attempt(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`])
      return out ? out.trim() : null
    },

    async currentBranch() {
      const out = await attempt(['symbolic-ref', '--quiet', '--short', 'HEAD'])
      return out ? out.trim() : null
    },

    /** Porcelain v1 status, branch line first, NUL separated for safe parsing. */
    async status() {
      const out = await attempt(['status', '--porcelain=v1', '--branch', '-z', '--untracked-files=all'])
      if (out === null) return null
      const [entries, ...rest] = out.split('\0').filter((entry) => entry !== '')
      const branchLine = entries ?? ''
      const files = rest.map((entry) => ({
        index: entry[0],
        worktree: entry[1],
        path: entry.slice(3),
      }))
      return { branchLine, files }
    },

    async remotes() {
      const out = await attempt(['remote', '-v'])
      if (!out) return []
      const seen = new Map()
      for (const line of out.split('\n').filter(Boolean)) {
        const [name, url] = line.split(/\s+/).filter(Boolean)
        if (!name || !url) continue
        if (!seen.has(name)) seen.set(name, { name, urls: [] })
        if (!seen.get(name).urls.includes(url)) seen.get(name).urls.push(url)
      }
      return [...seen.values()]
    },

    async localBranches() {
      const out = await attempt(['for-each-ref', '--format=%(refname:short)', 'refs/heads'])
      return out ? out.split('\n').filter(Boolean) : []
    },

    async remoteBranches() {
      const out = await attempt(['for-each-ref', '--format=%(refname:short)', 'refs/remotes'])
      return out ? out.split('\n').filter(Boolean) : []
    },

    /** Author identity as Git sees it, used only to explain a commit failure. */
    async identity() {
      const [name, email] = await Promise.all([
        attempt(['config', '--get', 'user.name']),
        attempt(['config', '--get', 'user.email']),
      ])
      return { name: name?.trim() ?? '', email: email?.trim() ?? '' }
    },

    async unmergedPaths() {
      const out = await attempt(['diff', '--name-only', '--diff-filter=U'])
      return out ? out.split('\n').filter(Boolean) : []
    },

    async diffNames(cached) {
      const args = ['diff', '--name-only']
      if (cached) args.push('--cached')
      const out = await attempt(args)
      return out ? out.split('\n').filter(Boolean) : []
    },

    async commitFiles(ref) {
      const out = await attempt(['show', '--name-only', '--pretty=format:', ref])
      return out ? out.split('\n').filter(Boolean) : []
    },

    async commitsTouching(path, range) {
      const args = ['log', '--format=%H']
      if (range) args.push(range)
      args.push('--', path)
      const out = await attempt(args)
      return out ? out.split('\n').filter(Boolean) : []
    },

    async firstParentCommitsTouching(path, range) {
      const out = await attempt(['log', '--first-parent', '--reverse', '--format=%H', range, '--', path])
      return out ? out.split('\n').filter(Boolean) : []
    },

    async fileAt(ref, path) {
      return (await attempt(['show', `${ref}:${path}`])) ?? ''
    },

    async commitSubjects(range) {
      const out = await attempt(['log', '--pretty=format:%h %s', range])
      return out ? out.split('\n').filter(Boolean) : []
    },

    async mergeBase(a, b) {
      const out = await attempt(['merge-base', a, b])
      return out ? out.trim() : null
    },

    async isAncestor(maybeAncestor, descendant) {
      const code = await new Promise((resolve) => {
        run('git', ['merge-base', '--is-ancestor', maybeAncestor, descendant], { cwd: repoRoot })
          .then(() => resolve(0))
          .catch((error) => resolve(error?.code ?? 1))
      })
      return code === 0
    },
  }
}

export const git = createGit
