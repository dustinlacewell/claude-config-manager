import { ClaudeMd, type Entity } from '@/ontology'
import { fs, join, type DirEntry } from './fs'
import type { Location } from './paths'
import { getCachedFile, setCachedFile, type FileStamp } from '@/registry'

const scopeKey = (loc: Location) =>
  loc.scope.type === 'user' ? 'user' : loc.scope.projectId

const rel = (root: string, path: string): string => {
  const r = root.replace(/\\/g, '/').replace(/\/+$/, '')
  const p = path.replace(/\\/g, '/')
  return p.startsWith(r) ? p.slice(r.length + 1) : p
}

const stampOf = (e: DirEntry): FileStamp => ({ mtime: e.mtime, size: e.size })

const buildEntity = (
  loc: Location,
  fullPath: string,
  raw: string,
): Entity<ClaudeMd> => {
  const relPath = rel(loc.root, fullPath)
  const value = ClaudeMd.parse({ name: relPath, relPath, body: raw })
  return {
    id: `claudemd:${scopeKey(loc)}:${relPath}`,
    kind: 'claudemd',
    scope: loc.scope,
    path: fullPath,
    value,
    origin: value,
    raw,
  }
}

const readKnownPath = async (
  loc: Location,
  fullPath: string,
): Promise<Entity<ClaudeMd> | null> => {
  const raw = await fs.readText(fullPath).catch(() => null)
  if (raw === null) return null
  return buildEntity(loc, fullPath, raw)
}

const readFromEntry = async (
  loc: Location,
  entry: DirEntry,
): Promise<Entity<ClaudeMd> | null> => {
  const stamp = stampOf(entry)
  const cached = getCachedFile<Entity<ClaudeMd>>(entry.path, stamp)
  if (cached) return cached
  const raw = await fs.readText(entry.path).catch(() => null)
  if (raw === null) return null
  const entity = buildEntity(loc, entry.path, raw)
  setCachedFile(entry.path, stamp, entity)
  return entity
}

export const readClaudeMds = async (loc: Location): Promise<Entity<ClaudeMd>[]> => {
  if (loc.scope.type === 'user') {
    const candidates = [
      join(loc.root, '.claude', 'CLAUDE.md'),
      join(loc.root, 'CLAUDE.md'),
    ]
    const out = (
      await Promise.all(candidates.map((p) => readKnownPath(loc, p)))
    ).filter((x): x is Entity<ClaudeMd> => x !== null)
    out.sort((a, b) => a.value.relPath.localeCompare(b.value.relPath))
    return out
  }
  const candidates = await fs.findFilesNamed(loc.root, 'CLAUDE.md', 4).catch(() => [])
  const out = (
    await Promise.all(candidates.map((e) => readFromEntry(loc, e)))
  ).filter((x): x is Entity<ClaudeMd> => x !== null)
  out.sort((a, b) => a.value.relPath.localeCompare(b.value.relPath))
  return out
}

export const claudeMdTargetPath = (loc: Location, c: ClaudeMd): string => {
  const relPath = (c.relPath || 'CLAUDE.md').replace(/^[/\\]+/, '')
  return join(loc.root, relPath)
}

export const writeClaudeMd = async (
  loc: Location,
  original: Entity<ClaudeMd> | null,
  next: ClaudeMd,
): Promise<string> => {
  const nextPath = claudeMdTargetPath(loc, next)
  if (original && original.path !== nextPath) {
    if (await fs.pathExists(original.path)) await fs.removePath(original.path)
  }
  await fs.writeText(nextPath, next.body)
  return nextPath
}

export const deleteClaudeMd = async (
  _loc: Location,
  entity: Entity<ClaudeMd>,
): Promise<void> => {
  if (await fs.pathExists(entity.path)) await fs.removePath(entity.path)
}
