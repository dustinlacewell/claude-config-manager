#!/usr/bin/env node
// Copy dist-demo/ → site/public/demo/ so Astro serves the embedded demo
// under /demo/ in the final site build. Run this after `npm run build:demo`
// and before `cd site && npm run build`.
//
// site/public/demo/ is in site/.gitignore — never commit the output.

import { cp, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const src = resolve(root, 'dist-demo')
const dst = resolve(root, 'site', 'public', 'demo')

if (!existsSync(src)) {
  console.error(
    `[copy-demo] ${src} does not exist. Run \`npm run build:demo\` first.`,
  )
  process.exit(1)
}

await rm(dst, { recursive: true, force: true })
await cp(src, dst, { recursive: true })

console.log(`[copy-demo] copied ${src} → ${dst}`)
