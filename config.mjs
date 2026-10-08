export const SLIDES_PORT = 3030
export const DASHBOARD_PORT = 3031
export const HOST = '127.0.0.1'

export const SLIDES_URL = `http://${HOST}:${SLIDES_PORT}`
export const DASHBOARD_URL = `http://${HOST}:${DASHBOARD_PORT}`

export const SLIDES_ENTRY = 'slides/index.md'

// Learner guide lives in ICTS Docs. Replace this base when the workshop entry is published.
export const GUIDE_BASE = 'https://docs.icts.tools/workshops/first-byte-git-mystery'

export const REPO_PATHS = {
  activity: 'activity',
  summary: 'activity/case/summary.md',
  findings: 'activity/case/findings.md',
  app: 'dashboard',
  slides: 'slides',
}

export const STATE_DIR = '.workshop-state'
export const STATE_FILE = `${STATE_DIR}/progress.json`

export const LEADS = ['lead-a', 'lead-b']