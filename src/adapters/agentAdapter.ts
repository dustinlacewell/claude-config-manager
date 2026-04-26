import { Agent, type Entity } from '@/ontology'
import { readMarkdownDir, writeMarkdown } from './markdown'
import { agentsDir, type Location } from './paths'
import { fs, join } from './fs'

const clean = (s: string): string =>
  s.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')

export const readAgents = (loc: Location): Promise<Entity<Agent>[]> =>
  readMarkdownDir({
    dir: agentsDir(loc),
    scope: loc.scope,
    kind: 'agent',
    build: ({ rawData, body, fileName }) =>
      Agent.parse({
        name: (rawData.name as string) ?? fileName,
        description: (rawData.description as string) ?? '',
        tools: rawData.tools as string[] | undefined,
        model: rawData.model as Agent['model'],
        color: rawData.color as string | undefined,
        body,
      }),
    idOf: (v) => v.name,
  })

export const agentTargetPath = (loc: Location, a: Agent): string =>
  join(agentsDir(loc), `${clean(a.name)}.md`)

export const writeAgent = async (
  loc: Location,
  original: Entity<Agent> | null,
  next: Agent,
): Promise<string> => {
  const nextPath = agentTargetPath(loc, next)
  if (original && original.path !== nextPath) {
    if (await fs.pathExists(original.path)) await fs.removePath(original.path)
  }
  const { body, ...fm } = next
  await writeMarkdown(nextPath, fm as Record<string, unknown>, body)
  return nextPath
}

export const deleteAgent = async (
  _loc: Location,
  entity: Entity<Agent>,
): Promise<void> => {
  if (await fs.pathExists(entity.path)) await fs.removePath(entity.path)
}

