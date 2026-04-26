import { Rule, type Entity } from '@/ontology'
import { readMarkdownDir, writeMarkdown } from './markdown'
import { rulesDir, type Location } from './paths'
import { fs, join } from './fs'

const clean = (s: string): string =>
  s.replace(/[^a-zA-Z0-9_\-\/]+/g, '-').replace(/^-+|-+$/g, '')

export const readRules = (loc: Location): Promise<Entity<Rule>[]> =>
  readMarkdownDir({
    dir: rulesDir(loc),
    scope: loc.scope,
    kind: 'rule',
    recursive: true,
    build: ({ rawData, body, relativePath }) => {
      const segments = relativePath.replace(/\.md$/, '').split('/')
      const name = segments.pop() ?? 'rule'
      const dirPath = segments.join('/')
      return Rule.parse({
        name,
        path: dirPath,
        description: (rawData.description as string) ?? '',
        paths: rawData.paths as string[] | undefined,
        body,
      })
    },
    idOf: (v) => (v.path ? `${v.path}/${v.name}` : v.name),
  })

const toFile = (r: Rule): string => {
  const safeName = clean(r.name)
  const safePath = clean(r.path)
  return safePath ? `${safePath}/${safeName}.md` : `${safeName}.md`
}

export const ruleTargetPath = (loc: Location, r: Rule): string =>
  join(rulesDir(loc), toFile(r))

export const writeRule = async (
  loc: Location,
  original: Entity<Rule> | null,
  next: Rule,
): Promise<string> => {
  const nextPath = ruleTargetPath(loc, next)
  if (original && original.path !== nextPath) {
    if (await fs.pathExists(original.path)) await fs.removePath(original.path)
  }
  const fm: Record<string, unknown> = {
    description: next.description,
    paths: next.paths,
  }
  await writeMarkdown(nextPath, fm, next.body)
  return nextPath
}

export const deleteRule = async (
  _loc: Location,
  entity: Entity<Rule>,
): Promise<void> => {
  if (await fs.pathExists(entity.path)) await fs.removePath(entity.path)
}
