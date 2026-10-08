const el = (tag, props = {}, children = []) => {
  const node = document.createElement(tag)
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value
    else if (key === 'text') node.textContent = value
    else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value)
    else if (value === true) node.setAttribute(key, '')
    else if (value) node.setAttribute(key, value)
  }
  for (const child of [children].flat()) {
    if (child == null) continue
    node.append(typeof child === 'string' ? document.createTextNode(child) : child)
  }
  return node
}

const inline = (text) =>
  String(text)
    .split(/(`[^`]+`)/)
    .filter(Boolean)
    .map((part) =>
      part.startsWith('`') && part.endsWith('`')
        ? el('code', { text: part.slice(1, -1) })
        : document.createTextNode(part),
    )

const shortId = (id) => id.slice(0, 2).toUpperCase()

async function api(path, body) {
  const response = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error ?? `The dashboard server returned ${response.status}.`)
  }
  return response.json()
}

function renderMissionList(data) {
  const currentId = data.progress.currentMissionId
  document.getElementById('progress-count').textContent = `${data.progress.solved} of ${data.progress.total} solved`

  document.getElementById('mission-list').replaceChildren(
    ...data.progress.missions.map((mission) => {
      const state = mission.verified ? 'solved' : mission.id === currentId ? 'current' : 'todo'
      return el('li', { class: 'mission', 'data-state': state }, [
        el('span', { class: 'state-dot' }),
        el('span', { class: 'mission-id', text: shortId(mission.id) }),
        el('span', { class: 'mission-name', text: mission.title }),
        el('span', { class: 'mission-badge', text: mission.kind === 'self-confirmed' ? 'self-confirmed' : 'verified' }),
      ])
    }),
  )
}

function renderCurrent(data) {
  const container = document.getElementById('current-mission-body')
  const mission = data.progress.missions.find((row) => row.id === data.progress.currentMissionId)

  if (!mission) {
    container.replaceChildren(
      el('h3', { class: 'mission-heading', text: 'All missions solved' }),
      el('p', { text: 'Nothing left to solve.' }),
      el('div', { class: 'callout' }, [
        'Read back your learned concepts, then read your final case summary and history one more time: ',
        ...inline('git log --oneline --graph'),
        '.',
      ]),
      el('div', { class: 'mission-links' }, [
        el('a', { href: data.progress.missions.at(-1)?.guide ?? data.guideRoot, text: 'Final guide section' }),
        el('a', { href: 'http://127.0.0.1:3030', text: 'Concept slides' }),
      ]),
    )
    return
  }

  const body = [
    el('h3', { class: 'mission-heading', text: `${shortId(mission.id)} — ${mission.title}` }),
    el('ol', { class: 'mission-steps' }, mission.steps.map((step) => el('li', {}, inline(step)))),
    el('div', { class: 'callout' }, ['Checkpoint. ', ...inline(mission.checkpoint)]),
    el('div', { class: 'callout-quiet' }, [...inline(mission.feedback)]),
    el('div', { class: 'mission-links' }, [
      el('a', { href: mission.guide, text: 'Full steps in the learner guide' }),
      el('a', { href: 'http://127.0.0.1:3030', text: 'Concept slides' }),
    ]),
  ]

  if (mission.id === 'm3-local-finding') body.push(checkStepField('unstaged-finding', 'Capture the local diff you just inspected'))
  if (mission.id === 'm4-save') body.push(checkStepField('staged-diff', 'Capture the staged diff you just inspected'))
  if (mission.id === 'm7-resolve') body.push(checkStepField('conflict', 'Capture the conflicted file'))
  if (mission.question) body.push(questionField(mission.question, data.state.answers[mission.question.id]))
  if (mission.freeAnswer) body.push(freeAnswerField(mission.freeAnswer, data.state.answers[mission.freeAnswer.id]))
  if (mission.confirmation) body.push(confirmationField(mission.confirmation, data.state.confirmations))

  container.replaceChildren(...body)
}

function checkStepField(key, label) {
  return el('div', { class: 'field' }, [
    el('h4', { class: 'field-title', text: 'Check step' }),
    el('p', { class: 'notice', text: 'This state disappears once you move on. Capture it while it is on screen.' }),
    el('div', { class: 'field-actions' }, [
      el('button', { class: 'pill-button', type: 'button', onClick: () => send('/api/checkpoint', { key, label }) }, [label]),
    ]),
  ])
}

function questionField(question, answer) {
  const chosen = answer?.value
  const field = el('div', { class: 'field' }, [
    el('h4', { class: 'field-title', text: 'Check your understanding' }),
    el('p', { class: 'field-label', text: question.prompt }),
    ...question.choices.map((choice) =>
      el('label', { class: 'choice' }, [
        el('input', { type: 'radio', name: question.id, value: choice.value, checked: chosen === choice.value }),
        el('span', { text: choice.label }),
      ]),
    ),
  ])

  field.append(
    el('div', { class: 'field-actions' }, [
      el('button', { class: 'pill-button', type: 'button', onClick: submit }, ['Save answer']),
    ]),
  )

  function submit() {
    const selected = field.querySelector(`input[name="${question.id}"]:checked`)
    if (selected) send('/api/answer', { id: question.id, value: selected.value })
  }

  return field
}

function freeAnswerField(spec, answer) {
  const inputId = `${spec.id}-input`
  const input = el('input', {
    type: 'text',
    id: inputId,
    value: answer?.value ?? '',
    placeholder: 'Your answer',
    autocomplete: 'off',
  })

  return el('div', { class: 'field' }, [
    el('h4', { class: 'field-title', text: 'Record your finding' }),
    el('label', { class: 'field-label', for: inputId, text: spec.prompt }),
    input,
    el('div', { class: 'field-actions' }, [
      el('button', {
        class: 'pill-button',
        type: 'button',
        onClick: () => send('/api/answer', { id: spec.id, value: input.value }),
      }, ['Save answer']),
    ]),
  ])
}

function confirmationField(spec, confirmations) {
  const wrap = el('div', { class: 'field' }, [
    el('h4', { class: 'field-title', text: 'Confirm your GitHub steps' }),
    el('p', {
      class: 'notice',
      text:
        'The app cannot see GitHub without your account, so these two steps are self-confirmed. It only checks the link you record.',
    }),
  ])

  for (const item of spec.items) {
    const entry = confirmations[item.key] ?? {}
    const inputId = `${item.key}-input`
    const input = el('input', {
      type: 'url',
      id: inputId,
      value: entry.url ?? '',
      placeholder: 'https://github.com/…/pull/1',
      autocomplete: 'off',
    })
    const toggle = el('label', { class: 'choice' }, [
      el('input', { type: 'checkbox', checked: Boolean(entry.openedAt) }),
      el('span', { text: 'I have opened and reviewed this pull request' }),
    ])

    wrap.append(
      el('label', { class: 'field-label', for: inputId, text: item.label }),
      input,
      toggle,
      el('div', { class: 'field-actions' }, [
        el('button', { class: 'pill-button', type: 'button', onClick: save }, ['Save']),
      ]),
    )

    function save() {
      const checked = toggle.querySelector('input').checked
      const stamp = new Date().toISOString()
      send('/api/confirm', {
        key: item.key,
        url: input.value,
        openedAt: checked ? stamp : '',
      })
    }
  }

  return wrap
}

function renderConcepts(data) {
  const all = []
  for (const mission of data.progress.missions) {
    for (const concept of mission.concepts) if (!all.includes(concept)) all.push(concept)
  }

  const learned = data.progress.learnedConcepts
  document.getElementById('concepts-list').replaceChildren(
    ...all.map((concept) =>
      el('li', { class: 'concept', 'data-learned': String(learned.includes(concept)), text: concept }),
    ),
  )
}

function renderRepoState(data) {
  const repo = data.repository
  const changes = [
    ...repo.dirty.unstaged.map((path) => `unstaged ${path}`),
    ...repo.dirty.staged.map((path) => `staged ${path}`),
    ...repo.dirty.untracked.map((path) => `untracked ${path}`),
  ]

  const rows = [
    ['checkout', repo.root],
    ['detected', String(repo.isRepository)],
    ['branch', repo.branch ?? 'detached'],
    ['HEAD', (repo.head ?? 'none').slice(0, 7)],
    ['baseline', (repo.baseline ?? 'none').slice(0, 7)],
    ['remotes', repo.remotes.map((remote) => remote.name).join(', ') || 'none'],
    ['local branches', repo.localBranches.join(', ') || 'none'],
    ['remote branches', repo.remoteBranches.join(', ') || 'none'],
    ['unmerged paths', repo.unmerged.join(', ') || 'none'],
    ['changes', changes.join(' · ') || 'working tree clean'],
  ]

  document.getElementById('repo-state').replaceChildren(
    ...rows.flatMap(([term, value]) => [el('dt', { text: term }), el('dd', { text: value })]),
  )
}

function render(data) {
  document.getElementById('progress-count').classList.remove('error-text')
  renderMissionList(data)
  renderCurrent(data)
  renderConcepts(data)
  renderRepoState(data)
}

function showError(message) {
  const node = document.getElementById('progress-count')
  node.textContent = 'Dashboard unavailable'
  node.classList.add('error-text')
  document.getElementById('current-mission-body').replaceChildren(el('p', { class: 'notice', text: message }))
}

async function send(path, body) {
  try {
    render(await api(path, body))
  } catch (error) {
    document.getElementById('action-feedback')?.remove()
    document.getElementById('current-mission-body').prepend(el('p', {
      id: 'action-feedback', class: 'notice error-text', role: 'alert', text: error.message,
    }))
  }
}

document.getElementById('refresh').addEventListener('click', () => send('/api/progress'))
document.getElementById('reset').addEventListener('click', () => {
  const sure = window.confirm(
    'Reset your answers, confirmations, and captured checkpoints? Case files and Git history are untouched.',
  )
  if (sure) send('/api/reset', {})
})

api('/api/progress').then(render).catch((error) => showError(error.message))
