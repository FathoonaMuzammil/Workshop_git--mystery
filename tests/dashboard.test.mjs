import { afterEach, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Window } from 'happy-dom'
import { createEvaluator } from '../lib/missions.mjs'
import { runRehearsal } from '../scripts/rehearse.mjs'
import { cleanup, makeWorkspace, sourceRoot } from '../scripts/workspace.mjs'

const roots = []
const windows = []
afterEach(async () => {
  for (const window of windows.splice(0)) await window.happyDOM.close()
  for (const root of roots.splice(0)) cleanup(root)
})

async function dashboard(data, rejectCheckpoint = false) {
  const window = new Window({ url: 'http://127.0.0.1:3031' })
  windows.push(window)
  window.document.write(readFileSync(resolve(sourceRoot, 'dashboard/public/index.html'), 'utf8'))
  const calls = []
  window.fetch = async (path, options) => {
    calls.push({ path, body: options?.body ? JSON.parse(options.body) : null })
    if (rejectCheckpoint && path === '/api/checkpoint') return new Response(JSON.stringify({ error: 'Stage the case file first.' }), { status: 409 })
    return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } })
  }
  window.eval(readFileSync(resolve(sourceRoot, 'dashboard/public/app.js'), 'utf8'))
  await new Promise((done) => setImmediate(done))
  return { window, document: window.document, calls }
}

test('students can capture the local diff and submit the M3 answer through the dashboard', async () => {
  const workspace = makeWorkspace('first-byte-ui-')
  roots.push(workspace.root)
  const data = await createEvaluator(workspace.clone).evaluate({})
  data.progress.currentMissionId = 'm3-local-finding'
  const page = await dashboard(data)
  const answer = page.document.querySelector('input[name="diff-meaning"][value="removed"]')
  expect(answer).not.toBeNull()
  answer.click()
  const buttons = [...page.document.querySelectorAll('#current-mission-body button')]
  const save = buttons.find((button) => button.textContent === 'Save answer')
  expect(save).toBeDefined()
  save.click()
  await new Promise((done) => setImmediate(done))
  expect(page.calls).toContainEqual({ path: '/api/answer', body: { id: 'diff-meaning', value: 'removed' } })
  expect(buttons.some((button) => button.textContent.includes('Capture'))).toBe(true)
})

test('both PR confirmation controls describe opening rather than merging', async () => {
  const workspace = makeWorkspace('first-byte-pr-ui-')
  roots.push(workspace.root)
  const data = await createEvaluator(workspace.clone).evaluate({})
  data.progress.currentMissionId = 'm6-pull-requests'
  const page = await dashboard(data)
  expect(page.document.querySelectorAll('#current-mission-body input[type="checkbox"]')).toHaveLength(2)
  expect(page.document.getElementById('current-mission-body').textContent).not.toContain('I have merged')
})

test('the completed dashboard renders learned concepts and repository state', async () => {
  const result = await runRehearsal()
  roots.push(result.root)
  const page = await dashboard(result.steps.at(-1).progress)
  expect(page.document.getElementById('progress-count').textContent).toBe('9 of 9 solved')
  expect(page.document.getElementById('current-mission-body').textContent).toContain('All missions solved')
  expect(page.document.querySelector('#current-mission-body a')?.getAttribute('href')).not.toBe('#')
  expect(page.document.querySelectorAll('#concepts-list [data-learned="true"]').length).toBeGreaterThan(0)
  expect(page.document.getElementById('repo-state').textContent).toContain(result.repository)
}, 120_000)

test('every mission guide link targets an existing local section without clue answers', async () => {
  const workspace = makeWorkspace('first-byte-guide-')
  roots.push(workspace.root)
  const data = await createEvaluator(workspace.clone).evaluate({})
  const guide = readFileSync(resolve(sourceRoot, 'dashboard/public/guide.html'), 'utf8')
  const window = new Window()
  windows.push(window)
  window.document.write(guide)
  for (const mission of data.progress.missions) {
    const [path, anchor] = mission.guide.split('#')
    expect(path).toBe('/guide.html')
    expect(window.document.getElementById(anchor)).not.toBeNull()
  }
  expect(guide).not.toContain('Perera')
  expect(guide).not.toContain('Silva')
  expect(guide).not.toContain('09:20')
  expect(guide).not.toContain('11:05')
})

test('a rejected checkpoint shows recovery feedback and retains retry controls', async () => {
  const workspace = makeWorkspace('first-byte-retry-ui-')
  roots.push(workspace.root)
  const data = await createEvaluator(workspace.clone).evaluate({})
  data.progress.currentMissionId = 'm4-save'
  const page = await dashboard(data, true)
  page.document.querySelector('#current-mission-body button').click()
  await new Promise((done) => setImmediate(done))
  expect(page.document.getElementById('action-feedback').textContent).toContain('Stage the case file first.')
  expect(page.document.querySelector('#current-mission-body button')).not.toBeNull()
  expect(page.document.getElementById('progress-count').textContent).not.toContain('unavailable')
})
