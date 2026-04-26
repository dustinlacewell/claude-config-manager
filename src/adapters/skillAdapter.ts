import { Skill, type Entity } from '@/ontology'
import { parse, stringify } from './frontmatter'
import { skillsDir, type Location } from './paths'
import { fs, join, basename, type DirEntry } from './fs'
import { getCachedFile, setCachedFile, type FileStamp } from '@/registry'

const clean = (s: string): string =>
  s.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')

const scopeSlug = (loc: Location): string =>
  loc.scope.type === 'user' ? 'user' : loc.scope.projectId

const stampOf = (e: DirEntry): FileStamp => ({ mtime: e.mtime, size: e.size })

const buildEntity = (
  loc: Location,
  skillDirName: string,
  skillPath: string,
  raw: string,
): Entity<Skill> => {
  try {
    const { data, body } = parse(raw)
    const value = Skill.parse({
      name: (data.name as string) ?? skillDirName,
      description: (data.description as string) ?? '',
      license: data.license as string | undefined,
      allowedTools: data['allowed-tools'] as string[] | undefined,
      body,
    })
    return {
      id: `skill:${scopeSlug(loc)}:${value.name}`,
      kind: 'skill',
      scope: loc.scope,
      path: skillPath,
      value,
      origin: value,
      raw,
    }
  } catch (err) {
    const fallback: Skill = { name: skillDirName, description: '', body: '' } as Skill
    return {
      id: `skill:${scopeSlug(loc)}:${skillDirName}`,
      kind: 'skill',
      scope: loc.scope,
      path: skillPath,
      value: fallback,
      origin: fallback,
      raw,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

const readSkillDir = async (
  loc: Location,
  dir: DirEntry,
): Promise<Entity<Skill> | null> => {
  const children = await fs.listDir(dir.path).catch(() => [])
  const skillEntry = children.find(
    (c) => c.is_file && c.name === 'SKILL.md',
  )
  if (!skillEntry) return null

  const stamp = stampOf(skillEntry)
  const cached = getCachedFile<Entity<Skill>>(skillEntry.path, stamp)
  if (cached) return cached

  const raw = await fs.readText(skillEntry.path).catch(() => null)
  if (raw === null) return null
  const entity = buildEntity(loc, basename(dir.path), skillEntry.path, raw)
  if (!entity.error) setCachedFile(skillEntry.path, stamp, entity)
  return entity
}

export const readSkills = async (loc: Location): Promise<Entity<Skill>[]> => {
  const root = skillsDir(loc)
  if (!(await fs.pathExists(root))) return []
  const dirs = (await fs.listDir(root)).filter((d) => d.is_dir)
  const results = await Promise.all(dirs.map((d) => readSkillDir(loc, d)))
  return results.filter((x): x is Entity<Skill> => x !== null)
}

const skillDir = (loc: Location, name: string): string =>
  join(skillsDir(loc), clean(name))

export const skillTargetPath = (loc: Location, s: Skill): string =>
  join(skillDir(loc, s.name), 'SKILL.md')

export const writeSkill = async (
  loc: Location,
  original: Entity<Skill> | null,
  next: Skill,
): Promise<string> => {
  const nextDir = skillDir(loc, next.name)
  if (original) {
    const originalDir = skillDir(loc, original.origin.name)
    if (originalDir !== nextDir && (await fs.pathExists(originalDir))) {
      await fs.removePath(originalDir)
    }
  }
  const nextPath = join(nextDir, 'SKILL.md')
  const fm: Record<string, unknown> = {
    name: next.name,
    description: next.description,
    license: next.license,
    'allowed-tools': next.allowedTools,
  }
  await fs.writeText(nextPath, stringify(fm, next.body))
  return nextPath
}

export const deleteSkill = async (
  loc: Location,
  entity: Entity<Skill>,
): Promise<void> => {
  const dir = skillDir(loc, entity.origin.name)
  if (await fs.pathExists(dir)) await fs.removePath(dir)
}
