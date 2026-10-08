import { REPO_PATHS } from '../config.mjs'

export const CHECKPOINT_KEYS = ['clean-tree', 'unstaged-finding', 'staged-diff', 'conflict']

/** Capture only Git states that are actually present, before they disappear. */
export async function captureCheckpoint(git, key) {
  const status = await git.status()
  if (!status) throw new Error('Open the workshop from a Git checkout first.')
  const at = new Date().toISOString()

  if (key === 'clean-tree') {
    if (status.files.length !== 0) throw new Error('Your working tree is not clean yet. Run `git status` to inspect it.')
    return { at, label: 'clean working tree' }
  }

  if (key === 'unstaged-finding') {
    if (!status.files.some((file) => file.path === REPO_PATHS.findings && file.index === ' ' && file.worktree !== ' ')) {
      throw new Error(`Edit ${REPO_PATHS.findings}, then inspect git diff before capturing this step.`)
    }
    return { at, label: 'unstaged case file' }
  }

  if (key === 'staged-diff') {
    const staged = await git.diffNames(true)
    if (!staged.includes(REPO_PATHS.findings) || (await git.unmergedPaths()).length !== 0) {
      throw new Error(`Stage ${REPO_PATHS.findings} and inspect git diff --staged before capturing this step.`)
    }
    return { at, label: 'staged case-file diff', head: await git.revParse('HEAD') }
  }

  if (key === 'conflict') {
    const [branch, head, mergeHead, main, unmerged] = await Promise.all([
      git.currentBranch(), git.revParse('HEAD'), git.revParse('MERGE_HEAD'), git.revParse('main'), git.unmergedPaths(),
    ])
    if (branch !== 'lead-b' || !head || !mergeHead || mergeHead !== main || !unmerged.includes(REPO_PATHS.summary)) {
      throw new Error('Capture this step on lead-b while merging main has left the case summary conflicted. Run git status to check.')
    }
    return { at, label: 'conflicted case summary', branch, head, mergeHead, path: REPO_PATHS.summary }
  }

  throw new Error('Unknown checkpoint.')
}
