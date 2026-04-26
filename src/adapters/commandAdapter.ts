import { Command, type Entity } from '@/ontology'
import { readMarkdownDir, writeMarkdown } from './markdown'
import { commandsDir, type Location } from './paths'
import { fs, join } from './fs'

const clean = (s: string): string =>
  s.replace(/[^a-zA-Z0-9_\-\/]+/g, '-').replace(/^-+|-+$/g, '')

export const readCommands = (loc: Location): Promise<Entity<Command>[]> =>
  readMarkdownDir({
    dir: commandsDir(loc),
    scope: loc.scope,
    kind: 'command',
    recursive: true,
    build: ({ rawData, body, relativePath }) => {
      const segments = relativePath.replace(/\.md$/, '').split('/')
      const name = segments.pop() ?? 'command'
      const dirPath = segments.join('/')
      return Command.parse({
        name,
        path: dirPath,
        description: (rawData.description as string) ?? '',
        argumentHint: (rawData['argument-hint'] as string) ?? undefined,
        allowedTools: rawData['allowed-tools'] as string[] | undefined,
        model: rawData.model as Command['model'],
        body,
      })
    },
    idOf: (v) => (v.path ? `${v.path}/${v.name}` : v.name),
  })

const toFile = (c: Command): string => {
  const safeName = clean(c.name)
  const safePath = clean(c.path)
  return safePath ? `${safePath}/${safeName}.md` : `${safeName}.md`
}

export const commandTargetPath = (loc: Location, c: Command): string =>
  join(commandsDir(loc), toFile(c))

export const writeCommand = async (
  loc: Location,
  original: Entity<Command> | null,
  next: Command,
): Promise<string> => {
  const nextPath = commandTargetPath(loc, next)
  if (original && original.path !== nextPath) {
    if (await fs.pathExists(original.path)) await fs.removePath(original.path)
  }
  const fm: Record<string, unknown> = {
    description: next.description,
    'argument-hint': next.argumentHint,
    'allowed-tools': next.allowedTools,
    model: next.model,
  }
  await writeMarkdown(nextPath, fm, next.body)
  return nextPath
}

export const deleteCommand = async (
  _loc: Location,
  entity: Entity<Command>,
): Promise<void> => {
  if (await fs.pathExists(entity.path)) await fs.removePath(entity.path)
}
