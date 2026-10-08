import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DASHBOARD_PORT, HOST } from '../config.mjs'
import { createEvaluator } from '../lib/missions.mjs'
import { createObserver } from '../lib/observe.mjs'
import { createStateStore } from '../lib/state.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const publicDir = resolve(here, 'public')

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

async function readBody(req, limit = 64 * 1024) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > limit) throw new Error('request body too large')
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new Error('request body must be JSON')
  }
}

export function createDashboard({ repoRoot, port = DASHBOARD_PORT, host = HOST, log = () => {} }) {
  const evaluator = createEvaluator(repoRoot)
  const store = createStateStore(repoRoot)
  const observe = createObserver({ git: evaluator.git, store })

    async function progress() {
    let state = store.read()
    if (!state.baselineCommit) {
      const head = await evaluator.git.revParse('HEAD')
      if (head) state = store.write({ ...state, baselineCommit: head })
    }
    state = await observe(state)
    return evaluator.evaluate(state)
  }

  

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://${host}:${port}`)
    const path = url.pathname

    try {
      if (req.method === 'GET' && (path === '/api/progress' || path === '/health')) {
        return sendJson(res, 200, await progress())
      }

      if (req.method === 'GET') {
        const file = path === '/' ? 'index.html' : path.slice(1)
        if (file.includes('..')) {
          res.writeHead(400).end('bad request')
          return
        }
        const body = await readFile(join(publicDir, file))
        res.writeHead(200, {
          'content-type': CONTENT_TYPES[extname(file)] ?? 'application/octet-stream',
          'cache-control': 'no-store',
        })
        return res.end(body)
      }

      if (req.method === 'POST') {
        const body = await readBody(req)

        if (path === '/api/answer') {
          if (typeof body.id !== 'string' || typeof body.value !== 'string') {
            return sendJson(res, 400, { error: 'answer needs an id and a value' })
          }
          const state = store.read()
          state.answers[body.id] = { value: body.value.slice(0, 500), at: new Date().toISOString() }
          store.write(state)
          return sendJson(res, 200, await progress())
        }

        if (path === '/api/checkpoint') {
          if (typeof body.key !== 'string') {
            return sendJson(res, 400, { error: 'checkpoint needs a key' })
          }
          const state = store.read()
          state.checkpoints[body.key] = { at: new Date().toISOString(), label: String(body.label ?? body.key) }
          store.write(state)
          return sendJson(res, 200, await progress())
        }

        if (path === '/api/confirm') {
          if (typeof body.key !== 'string') {
            return sendJson(res, 400, { error: 'confirmation needs a key' })
          }
          const state = store.read()
          const current = state.confirmations[body.key] ?? {}
          state.confirmations[body.key] = {
            url: typeof body.url === 'string' ? body.url.trim().slice(0, 300) : current.url ?? '',
            mergedAt: typeof body.mergedAt === 'string' ? body.mergedAt : current.mergedAt ?? '',
            openedAt: typeof body.openedAt === 'string' ? body.openedAt : current.openedAt ?? '',
          }
          store.write(state)
          return sendJson(res, 200, await progress())
        }

        if (path === '/api/reset') {
          store.clear()
          return sendJson(res, 200, await progress())
        }

        return sendJson(res, 404, { error: 'unknown endpoint' })
      }

      res.writeHead(405, { allow: 'GET, POST' }).end('method not allowed')
    } catch (error) {
      log(`dashboard error: ${error.message}`)
      if (!res.headersSent) sendJson(res, 500, { error: error.message })
      else res.end()
    }
  })

  return {
    server,
    progress,
    listen: () =>
      new Promise((resolvePromise, rejectPromise) => {
        server.once('error', rejectPromise)
        server.listen(port, host, () => {
          server.off('error', rejectPromise)
          resolvePromise(server.address())
        })
      }),
    close: () => new Promise((resolvePromise) => server.close(() => resolvePromise())),
  }
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))

if (invokedDirectly) {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const dashboard = createDashboard({ repoRoot, log: (message) => process.stderr.write(`${message}\n`) })
  dashboard
    .listen()
    .then(() => process.stdout.write(`Dashboard on http://${HOST}:${DASHBOARD_PORT}\n`))
    .catch((error) => {
      process.stderr.write(`Dashboard failed to start: ${error.message}\n`)
      process.exit(1)
    })
}