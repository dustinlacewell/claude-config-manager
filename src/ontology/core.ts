import { z } from 'zod'

export const Kind = z.enum([
  'claudemd',
  'memory',
  'agent',
  'command',
  'skill',
  'rule',
  'hook',
  'mcp',
  'plugin',
  'marketplace',
  'conversation',
  'catalog',
])
export type Kind = z.infer<typeof Kind>

export const Scope = z.discriminatedUnion('type', [
  z.object({ type: z.literal('user') }),
  z.object({ type: z.literal('project'), projectId: z.string() }),
])
export type Scope = z.infer<typeof Scope>

export const scopeKey = (s: Scope): string =>
  s.type === 'user' ? 'user' : `project:${s.projectId}`

export const scopeEq = (a: Scope, b: Scope): boolean => scopeKey(a) === scopeKey(b)

export interface Entity<T> {
  id: string
  kind: Kind
  scope: Scope
  path: string
  value: T
  origin: T
  raw: string
  error?: string
  dirty?: boolean
}

export type AnyEntity = Entity<unknown>
