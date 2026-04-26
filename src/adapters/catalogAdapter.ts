import { type CatalogEntry, type Entity } from '@/ontology'
import { builtinCatalog } from '@/data/catalog'
import { fetchSkillsSh } from './skillsShScraper'
import { claudeDir, projectMcpPath, userClaudeJson, type Location } from './paths'
import { fs, join, readJsonOrNull } from './fs'

const clean = (s: string): string =>
  s.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')

export const readCatalog = async (
  loc: Location,
  home: string,
): Promise<Entity<CatalogEntry>[]> => {
  const cd = claudeDir(loc)
  const [agentFiles, skillFiles, mcpJson, liveSkills] = await Promise.all([
    fs.listDir(join(cd, 'agents')).catch(() => []),
    fs.listDir(join(cd, 'skills')).catch(() => []),
    loc.scope.type === 'user'
      ? readJsonOrNull<{ mcpServers?: Record<string, unknown> }>(userClaudeJson(home))
      : readJsonOrNull<{ mcpServers?: Record<string, unknown> }>(projectMcpPath(loc)),
    fetchSkillsSh().catch(() => []),
  ])

  const agentNames = new Set(
    agentFiles.filter((e) => e.is_file && e.name.endsWith('.md')).map((e) => e.name.slice(0, -3)),
  )
  const skillNames = new Set(
    skillFiles.filter((e) => e.is_file && e.name.endsWith('.md')).map((e) => e.name.slice(0, -3)),
  )
  const mcpNames = new Set(Object.keys(mcpJson?.mcpServers ?? {}))

  const checkInstalled = (raw: CatalogEntry): boolean =>
    raw.type === 'agent'
      ? agentNames.has(clean(raw.name))
      : raw.type === 'skill'
        ? skillNames.has(clean(raw.name))
        : mcpNames.has(raw.name)

  const seen = new Set<string>()
  const entities: Entity<CatalogEntry>[] = []

  for (const raw of builtinCatalog) {
    seen.add(raw.id)
    const value: CatalogEntry = { ...raw, installed: checkInstalled(raw as CatalogEntry) }
    entities.push({
      id: `catalog:${raw.id}`,
      kind: 'catalog',
      scope: loc.scope,
      path: '',
      value,
      origin: value,
      raw: JSON.stringify(raw),
    })
  }

  for (const live of liveSkills) {
    if (seen.has(live.id)) continue
    seen.add(live.id)
    const value: CatalogEntry = { ...live, installed: checkInstalled(live) }
    entities.push({
      id: `catalog:${live.id}`,
      kind: 'catalog',
      scope: loc.scope,
      path: '',
      value,
      origin: value,
      raw: JSON.stringify(live),
    })
  }

  return entities
}
