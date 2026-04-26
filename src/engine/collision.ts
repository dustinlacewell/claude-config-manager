import type { Kind } from '@/ontology'
import { pluginKey } from '@/ontology'
import { fs, readByKind, type WriteContext } from '@/adapters'
import { agentTargetPath } from '@/adapters/agentAdapter'
import { commandTargetPath } from '@/adapters/commandAdapter'
import { ruleTargetPath } from '@/adapters/ruleAdapter'
import { skillTargetPath } from '@/adapters/skillAdapter'
import { claudeMdTargetPath } from '@/adapters/claudemdAdapter'
import { memoryTargetPath } from '@/adapters/memoryAdapter'

export interface CollisionInfo {
  /** Human-readable hint for the confirm dialog (path or key). */
  where: string
}

/**
 * Does an entity of `kind` with the shape of `value` already exist at `ctx`'s
 * location? Returns a description when it does, `null` otherwise.
 *
 * Used to gate cross-scope copy/move and scope-targeted create against silent
 * overwrites. Hooks are intentionally excluded — duplicate event+matcher
 * entries are legitimate, so "copy" of a hook always appends.
 */
export const entityExistsAt = async (
  ctx: WriteContext,
  kind: Kind,
  value: any,
): Promise<CollisionInfo | null> => {
  switch (kind) {
    case 'agent': {
      const p = agentTargetPath(ctx.loc, value)
      return (await fs.pathExists(p)) ? { where: p } : null
    }
    case 'command': {
      const p = commandTargetPath(ctx.loc, value)
      return (await fs.pathExists(p)) ? { where: p } : null
    }
    case 'rule': {
      const p = ruleTargetPath(ctx.loc, value)
      return (await fs.pathExists(p)) ? { where: p } : null
    }
    case 'skill': {
      const p = skillTargetPath(ctx.loc, value)
      return (await fs.pathExists(p)) ? { where: p } : null
    }
    case 'claudemd': {
      const p = claudeMdTargetPath(ctx.loc, value)
      return (await fs.pathExists(p)) ? { where: p } : null
    }
    case 'memory': {
      const p = memoryTargetPath(ctx.loc, ctx.home, value)
      if (!p) return null
      return (await fs.pathExists(p)) ? { where: p } : null
    }
    case 'mcp': {
      const existing = await readByKind('mcp', ctx.loc, ctx.home)
      const hit = existing.find((e) => (e.value as any).name === value.name)
      return hit ? { where: `mcp server "${value.name}"` } : null
    }
    case 'marketplace': {
      const existing = await readByKind('marketplace', ctx.loc, ctx.home)
      const hit = existing.find((e) => (e.value as any).name === value.name)
      return hit ? { where: `marketplace "${value.name}"` } : null
    }
    case 'plugin': {
      const existing = await readByKind('plugin', ctx.loc, ctx.home)
      const targetKey = pluginKey(value)
      const hit = existing.find((e) => {
        const v = e.value as any
        return (
          pluginKey(v) === targetKey &&
          v.version === value.version &&
          (v.scope ?? 'user') === (value.scope ?? 'user')
        )
      })
      return hit ? { where: `plugin "${targetKey}@${value.version}"` } : null
    }
    case 'conversation': {
      const existing = await readByKind('conversation', ctx.loc, ctx.home)
      const hit = existing.find(
        (e) => (e.value as any).sessionId === value.sessionId,
      )
      return hit ? { where: `conversation ${value.sessionId}` } : null
    }
    case 'hook':
      // Duplicate event+matcher hooks are legitimate — skip.
      return null
  }
}
