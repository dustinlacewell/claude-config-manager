import type { ZodTypeAny } from 'zod'
import { Agent } from './agent'
import { Command } from './command'
import { Skill } from './skill'
import { Rule } from './rule'
import { Hook } from './hook'
import { McpServer } from './mcp'
import { Plugin } from './plugin'
import { Marketplace } from './marketplace'
import { ClaudeMd } from './claudemd'
import { Memory } from './memory'
import { Conversation } from './conversation'
import { CatalogEntry } from './catalog'
import type { Kind } from './core'

export * from './core'
export * from './schema'
export * from './project'
export * from './agent'
export * from './command'
export * from './skill'
export * from './rule'
export * from './hook'
export * from './mcp'
export * from './plugin'
export * from './marketplace'
export * from './claudemd'
export * from './memory'
export * from './conversation'
export * from './catalog'
export * from './settings'

export type ScopeType = 'user' | 'project'

export interface KindSpec<T> {
  kind: Kind
  label: string
  pluralLabel: string
  schema: ZodTypeAny
  validScopes: ScopeType[]
  /** Scopes that can be selected as a copy/move target. Defaults to `validScopes`. */
  targetableScopes?: ScopeType[]
  readOnly?: boolean
  /** Read-only for content edits, but the artifact file can still be moved/copied/deleted. */
  allowScopeMove?: boolean
  /** Suppress the "+ New" button and palette create entries. Useful when entities are managed externally. */
  noCreate?: boolean
  idOf: (value: T) => string
  nameOf: (value: T) => string
  searchText: (value: T) => string
}

export const agentSpec: KindSpec<Agent> = {
  kind: 'agent',
  label: 'Agent',
  pluralLabel: 'Agents',
  schema: Agent,
  validScopes: ['user', 'project'],
  idOf: (v) => v.name,
  nameOf: (v) => v.name,
  searchText: (v) => `${v.name} ${v.description} ${v.body}`.toLowerCase(),
}

export const commandSpec: KindSpec<Command> = {
  kind: 'command',
  label: 'Command',
  pluralLabel: 'Commands',
  schema: Command,
  validScopes: ['user', 'project'],
  idOf: (v) => (v.path ? `${v.path}/${v.name}` : v.name),
  nameOf: (v) => (v.path ? `${v.path}/${v.name}` : v.name),
  searchText: (v) => `${v.name} ${v.path} ${v.description} ${v.body}`.toLowerCase(),
}

export const skillSpec: KindSpec<Skill> = {
  kind: 'skill',
  label: 'Skill',
  pluralLabel: 'Skills',
  schema: Skill,
  validScopes: ['user', 'project'],
  idOf: (v) => v.name,
  nameOf: (v) => v.name,
  searchText: (v) => `${v.name} ${v.description} ${v.body}`.toLowerCase(),
}

export const ruleSpec: KindSpec<Rule> = {
  kind: 'rule',
  label: 'Rule',
  pluralLabel: 'Rules',
  schema: Rule,
  validScopes: ['user', 'project'],
  idOf: (v) => (v.path ? `${v.path}/${v.name}` : v.name),
  nameOf: (v) => (v.path ? `${v.path}/${v.name}` : v.name),
  searchText: (v) => `${v.name} ${v.path} ${v.description} ${v.body}`.toLowerCase(),
}

export const hookSpec: KindSpec<Hook> = {
  kind: 'hook',
  label: 'Hook',
  pluralLabel: 'Hooks',
  schema: Hook,
  validScopes: ['user', 'project'],
  idOf: (v) => `${v.event}::${v.matcher}::${v.index}`,
  nameOf: (v) => `${v.event}${v.matcher ? ` [${v.matcher}]` : ''}`,
  searchText: (v) =>
    `${v.event} ${v.matcher} ${v.handlers.map((h) => h.command).join(' ')}`.toLowerCase(),
}

export const mcpSpec: KindSpec<McpServer> = {
  kind: 'mcp',
  label: 'MCP Server',
  pluralLabel: 'MCP Servers',
  schema: McpServer,
  validScopes: ['user', 'project'],
  idOf: (v) => v.name,
  nameOf: (v) => v.name,
  searchText: (v) =>
    `${v.name} ${v.command} ${v.args.join(' ')}`.toLowerCase(),
}

export const pluginSpec: KindSpec<Plugin> = {
  kind: 'plugin',
  label: 'Plugin',
  pluralLabel: 'Plugins',
  schema: Plugin,
  validScopes: ['user'],
  noCreate: true,
  idOf: (v) => `${v.name}@${v.marketplace}`,
  nameOf: (v) => `${v.name}@${v.marketplace}`,
  searchText: (v) =>
    `${v.name} ${v.marketplace} ${v.version ?? ''} ${v.description ?? ''} ${v.category ?? ''} ${v.keywords.join(' ')}`.toLowerCase(),
}

export const marketplaceSpec: KindSpec<Marketplace> = {
  kind: 'marketplace',
  label: 'Marketplace',
  pluralLabel: 'Marketplaces',
  schema: Marketplace,
  validScopes: ['user'],
  idOf: (v) => v.name,
  nameOf: (v) => v.name,
  searchText: (v) => `${v.name} ${typeof v.source === 'string' ? v.source : JSON.stringify(v.source)}`.toLowerCase(),
}

export const claudemdSpec: KindSpec<ClaudeMd> = {
  kind: 'claudemd',
  label: 'CLAUDE.md',
  pluralLabel: 'Instructions',
  schema: ClaudeMd,
  validScopes: ['user', 'project'],
  idOf: (v) => v.relPath,
  nameOf: (v) => v.name,
  searchText: (v) => `${v.name} ${v.relPath} ${v.body}`.toLowerCase(),
}

export const memorySpec: KindSpec<Memory> = {
  kind: 'memory',
  label: 'Memory',
  pluralLabel: 'Memories',
  schema: Memory,
  validScopes: ['project'],
  idOf: (v) => v.name,
  nameOf: (v) => v.name,
  searchText: (v) =>
    `${v.name} ${v.type} ${v.description} ${v.body}`.toLowerCase(),
}

export const conversationSpec: KindSpec<Conversation> = {
  kind: 'conversation',
  label: 'Conversation',
  pluralLabel: 'Conversations',
  schema: Conversation,
  validScopes: ['user', 'project'],
  targetableScopes: ['project'],
  readOnly: true,
  allowScopeMove: true,
  idOf: (v) => v.sessionId,
  nameOf: (v) => v.title,
  searchText: (v) => `${v.title} ${v.projectDir}`.toLowerCase(),
}

export const catalogSpec: KindSpec<CatalogEntry> = {
  kind: 'catalog',
  label: 'Catalog',
  pluralLabel: 'Catalog',
  schema: CatalogEntry,
  validScopes: ['user', 'project'],
  readOnly: true,
  noCreate: true,
  idOf: (v) => v.id,
  nameOf: (v) => v.name,
  searchText: (v) =>
    `${v.name} ${v.type} ${v.description} ${v.author} ${v.tags.join(' ')}`.toLowerCase(),
}

export const kindSpecs: Record<Kind, KindSpec<any>> = {
  claudemd: claudemdSpec,
  memory: memorySpec,
  agent: agentSpec,
  command: commandSpec,
  skill: skillSpec,
  rule: ruleSpec,
  hook: hookSpec,
  mcp: mcpSpec,
  plugin: pluginSpec,
  marketplace: marketplaceSpec,
  conversation: conversationSpec,
  catalog: catalogSpec,
}

export const allKinds: Kind[] = [
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
]

export const kindSupportsScope = (kind: Kind, scope: { type: ScopeType }): boolean =>
  kindSpecs[kind].validScopes.includes(scope.type)

export const kindTargetableScopes = (kind: Kind): readonly ScopeType[] =>
  kindSpecs[kind].targetableScopes ?? kindSpecs[kind].validScopes

export const allKindsForScope = (scope: { type: ScopeType }): Kind[] =>
  allKinds.filter((k) => kindSupportsScope(k, scope))
