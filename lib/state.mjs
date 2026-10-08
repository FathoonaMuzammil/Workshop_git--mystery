import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { STATE_DIR, STATE_FILE } from '../config.mjs'

function blank() {
  return {
    version: 1,
    baselineCommit: null,
    answers: {},
    confirmations: {},
    checkpoints: {},
  }
}

export function createStateStore(repoRoot) {
  const path = `${repoRoot}/${STATE_FILE}`

  function read() {
    try {
      return { ...blank(), ...JSON.parse(readFileSync(path, 'utf8')) }
    } catch {
      return blank()
    }
  }

  function write(next) {
    const merged = { ...blank(), ...next }
    mkdirSync(`${repoRoot}/${STATE_DIR}`, { recursive: true })
    writeFileSync(path, `${JSON.stringify(merged, null, 2)}\n`)
    return merged
  }

  return {
    dir: STATE_DIR,
    path,
    read,
    write,
    clear: () => write(blank()),
  }
}