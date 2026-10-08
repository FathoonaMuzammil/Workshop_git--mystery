import { REPO_PATHS } from '../config.mjs'

/**
 * Two observations the app can make on its own: a clean working tree, and an
 * unstaged change to the case file. Both vanish on their own, so they are
 * recorded the first time they are seen.
 *
 * The staged diff and the active conflict are deliberately not observed here.
 * Those stay behind explicit Check step actions in the dashboard.
 */
export function createObserver({ git, store }) {
  return async function observe(state) {
    const status = await git.status()
    const next = { ...state, checkpoints: { ...state.checkpoints } }
    let changed = false

    if (status) {
      const unstaged = status.files.filter((file) => file.index === ' ' && file.worktree !== ' ')
      const staged = status.files.filter((file) => file.index !== ' ' && file.index !== '?')
      const untracked = status.files.filter((file) => file.index === '?')

      if (unstaged.length + staged.length + untracked.length === 0 && !next.checkpoints['clean-tree']) {
        next.checkpoints['clean-tree'] = { at: new Date().toISOString(), label: 'clean working tree' }
        changed = true
      }

      if (unstaged.some((file) => file.path === REPO_PATHS.findings) && !next.checkpoints['unstaged-finding']) {
        next.checkpoints['unstaged-finding'] = { at: new Date().toISOString(), label: 'unstaged case file' }
        changed = true
      }
    }

    return changed ? store.write(next) : state
  }
}