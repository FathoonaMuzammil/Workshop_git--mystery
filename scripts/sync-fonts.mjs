#!/usr/bin/env node
import { copyFileSync, mkdirSync, rmSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Copy the open-source Instrument Sans variable font out of node_modules into
 * the two static directories that serve it, so both surfaces render offline with
 * no webfont request at run time.
 */
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(repoRoot, 'node_modules/@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2')
const targets = [
  resolve(repoRoot, 'dashboard/public/fonts/instrument-sans-latin-variable.woff2'),
  resolve(repoRoot, 'slides/public/fonts/instrument-sans-latin-variable.woff2'),
]

for (const target of targets) {
  mkdirSync(dirname(target), { recursive: true })
  copyFileSync(source, target)
  process.stdout.write(`wrote ${target.replace(`${repoRoot}/`, '')} (${statSync(target).size} bytes)\n`)
}

rmSync(resolve(repoRoot, 'dashboard/public/fonts/inter-latin-variable.woff2'), { force: true })
rmSync(resolve(repoRoot, 'slides/public/fonts/inter-latin-variable.woff2'), { force: true })

process.stdout.write('Instrument Sans is licensed under the SIL Open Font License 1.1.\n')