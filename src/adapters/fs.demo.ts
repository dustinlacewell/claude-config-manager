/**
 * Browser-mode replacement for fs.ts. Backs every filesystem call with an
 * in-memory virtual tree seeded from {@link fixtureFiles}. No IPC, no disk,
 * no Tauri — pure JS, so the exact same React app can run in an iframe on
 * the marketing site.
 *
 * Paths are normalized to forward slashes, no trailing slash. Watcher
 * events are no-ops; nothing changes the tree from outside the page.
 *
 * Public surface must match fs.ts exactly. When fs.ts grows, update here.
 */

// `type`-only import from @tauri-apps/api is tree-shaken at build time,
// but we redeclare the essential shape to avoid any runtime dependency.
type UnlistenFn = () => void

import { fixtureFiles, fixtureHome } from './fs.demo.fixture'

export interface DirEntry {
  name: string
  path: string
  is_dir: boolean
  is_file: boolean
  mtime: number
  size: number
}

export interface FsChange {
  kind: 'create' | 'modify' | 'remove' | 'other'
  paths: string[]
}

export interface ProjectHit {
  path: string
  has_claude_md: boolean
  has_claude_dir: boolean
}

// ── VFS primitives ──────────────────────────────────────────────────────

interface VFile {
  content: string
  mtime: number
}

const files = new Map<string, VFile>()
const dirs = new Set<string>(['/'])

let clock = 1_710_000_000_000 // stable-ish starting mtime
const tick = (): number => ++clock

const normalize = (p: string): string => {
  const n = p.replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/\/$/, '')
  return n || '/'
}

const parentOf = (p: string): string => {
  const parts = p.split('/').filter(Boolean)
  parts.pop()
  return parts.length ? '/' + parts.join('/') : '/'
}

const seedDirChain = (path: string) => {
  const parts = normalize(path).split('/').filter(Boolean)
  let cur = ''
  for (const p of parts) {
    cur = cur + '/' + p
    dirs.add(cur)
  }
}

const writeFileRaw = (path: string, content: string) => {
  const n = normalize(path)
  seedDirChain(parentOf(n))
  files.set(n, { content, mtime: tick() })
}

// Seed the fixture at module load — no init phase needed by callers.
for (const f of fixtureFiles) writeFileRaw(f.path, f.content)

// ── fs surface ──────────────────────────────────────────────────────────

const missing = (path: string): never => {
  throw new Error(`ENOENT: no such file or directory: ${path}`)
}

const listAt = (rootPath: string, maxDepth: number): DirEntry[] => {
  const root = normalize(rootPath)
  const prefix = root === '/' ? '/' : root + '/'
  const baseDepth = root === '/' ? 0 : root.split('/').filter(Boolean).length
  const out: DirEntry[] = []

  const inside = (p: string): boolean =>
    root === '/' ? p !== '/' : p.startsWith(prefix)

  const depthOf = (p: string): number =>
    p.split('/').filter(Boolean).length - baseDepth

  for (const d of dirs) {
    if (!inside(d)) continue
    const depth = depthOf(d)
    if (depth < 1 || depth > maxDepth) continue
    out.push({
      name: d.split('/').pop() ?? '',
      path: d,
      is_dir: true,
      is_file: false,
      mtime: 0,
      size: 0,
    })
  }
  for (const [p, v] of files) {
    if (!inside(p)) continue
    const depth = depthOf(p)
    if (depth < 1 || depth > maxDepth) continue
    out.push({
      name: p.split('/').pop() ?? '',
      path: p,
      is_dir: false,
      is_file: true,
      mtime: v.mtime,
      size: v.content.length,
    })
  }
  return out
}

export const fs = {
  homeDir: async (): Promise<string> => fixtureHome,

  readText: async (path: string): Promise<string> => {
    const n = normalize(path)
    const f = files.get(n)
    if (!f) return missing(n)
    return f.content
  },

  writeText: async (path: string, contents: string): Promise<void> => {
    writeFileRaw(path, contents)
  },

  readJson: async <T = unknown>(path: string): Promise<T> => {
    const text = await fs.readText(path)
    return JSON.parse(text) as T
  },

  writeJson: async (path: string, value: unknown): Promise<void> => {
    await fs.writeText(path, JSON.stringify(value, null, 2))
  },

  pathExists: async (path: string): Promise<boolean> => {
    const n = normalize(path)
    return files.has(n) || dirs.has(n)
  },

  ensureDir: async (path: string): Promise<void> => {
    seedDirChain(path)
  },

  removePath: async (path: string): Promise<void> => {
    const n = normalize(path)
    if (files.delete(n)) return
    const prefix = n + '/'
    for (const f of [...files.keys()]) {
      if (f === n || f.startsWith(prefix)) files.delete(f)
    }
    for (const d of [...dirs]) {
      if (d === n || d.startsWith(prefix)) dirs.delete(d)
    }
  },

  renamePath: async (from: string, to: string): Promise<void> => {
    const nf = normalize(from)
    const nt = normalize(to)
    const f = files.get(nf)
    if (f) {
      files.delete(nf)
      seedDirChain(parentOf(nt))
      files.set(nt, { content: f.content, mtime: tick() })
      return
    }
    if (!dirs.has(nf)) return
    const prefix = nf + '/'
    const fileMoves: [string, VFile][] = []
    for (const [k, v] of files) {
      if (k.startsWith(prefix)) fileMoves.push([nt + k.slice(nf.length), v])
    }
    for (const [k] of fileMoves) files.delete(k)
    const dirMoves: string[] = []
    for (const d of dirs) if (d === nf || d.startsWith(prefix)) dirMoves.push(d)
    for (const d of dirMoves) dirs.delete(d)
    for (const d of dirMoves) dirs.add(nt + d.slice(nf.length))
    seedDirChain(parentOf(nt))
    dirs.add(nt)
    for (const [k, v] of fileMoves) files.set(k, { ...v, mtime: tick() })
  },

  listDir: async (path: string): Promise<DirEntry[]> => listAt(path, 1),

  listDirRecursive: async (path: string, maxDepth?: number): Promise<DirEntry[]> =>
    listAt(path, maxDepth ?? 16),

  findFilesNamed: async (
    root: string,
    name: string,
    maxDepth?: number,
  ): Promise<DirEntry[]> => {
    const all = await fs.listDirRecursive(root, maxDepth)
    return all.filter((e) => e.is_file && e.name === name)
  },

  watchPaths: async (_paths: string[]): Promise<void> => {},
  unwatchAll: async (): Promise<void> => {},

  scanForProjects: async (_root: string, _maxDepth?: number): Promise<ProjectHit[]> => [],

  onChange: async (_cb: (ev: FsChange) => void): Promise<UnlistenFn> => {
    return () => {}
  },

  runClaudeCli: async (): Promise<{
    stdout: string
    stderr: string
    exit_code: number
  }> => ({
    stdout: '',
    stderr: 'Claude CLI is not available in the demo.',
    exit_code: 1,
  }),

  openExternal: async (target: string): Promise<void> => {
    if (typeof window !== 'undefined') {
      window.open(target, '_blank', 'noopener,noreferrer')
    }
  },
}

// ── helpers (must mirror fs.ts) ─────────────────────────────────────────

export const readTextOrNull = async (path: string): Promise<string | null> => {
  try {
    return await fs.readText(path)
  } catch {
    return null
  }
}

export const readJsonOrNull = async <T = unknown>(path: string): Promise<T | null> => {
  try {
    return await fs.readJson<T>(path)
  } catch {
    return null
  }
}

export const join = (...parts: string[]): string =>
  parts
    .filter(Boolean)
    .map((p) => p.replace(/[\/\\]+$/, ''))
    .join('/')
    .replace(/\/+/g, '/')

export const basename = (p: string): string =>
  p.replace(/[\/\\]+$/, '').split(/[\/\\]/).pop() ?? p

export const dirname = (p: string): string => {
  const parts = p.replace(/\\/g, '/').split('/')
  parts.pop()
  return parts.join('/') || '/'
}

export const stripExt = (name: string, ext: string): string =>
  name.endsWith(ext) ? name.slice(0, -ext.length) : name
