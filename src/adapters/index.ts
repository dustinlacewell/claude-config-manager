import type { AnyEntity, Entity, Kind } from '@/ontology'
import type { Location } from './paths'
import { readAgents, writeAgent, deleteAgent } from './agentAdapter'
import { readCommands, writeCommand, deleteCommand } from './commandAdapter'
import { readSkills, writeSkill, deleteSkill } from './skillAdapter'
import { readRules, writeRule, deleteRule } from './ruleAdapter'
import { readHooks, writeHook, deleteHook } from './hookAdapter'
import { readMcpServers, writeMcpServer, deleteMcpServer } from './mcpAdapter'
import { readPlugins, writePlugin, deletePlugin } from './pluginAdapter'
import {
  readMarketplaces,
  writeMarketplace,
  deleteMarketplace,
} from './marketplaceAdapter'
import { readClaudeMds, writeClaudeMd, deleteClaudeMd } from './claudemdAdapter'
import { readMemories, writeMemoryEntry, deleteMemoryEntry } from './memoryAdapter'
import {
  readConversations,
  writeConversation,
  deleteConversation,
} from './conversationAdapter'
import { readCatalog } from './catalogAdapter'

export * from './fs'
export * from './paths'
export * from './selfWrites'
export * from './frontmatter'
export * from './conversationAdapter'
export * from './tokenCounter'

export const readAll = async (loc: Location, home: string): Promise<AnyEntity[]> => {
  const results = await Promise.all([
    readAgents(loc),
    readCommands(loc),
    readSkills(loc),
    readRules(loc),
    readHooks(loc),
    readMcpServers(loc, home),
    readPlugins(loc, home),
    readMarketplaces(loc, home),
    readClaudeMds(loc),
    readMemories(loc, home),
    readConversations(loc, home).then((r) => r.entities),
    readCatalog(loc, home),
  ])
  return results.flat() as AnyEntity[]
}

export const readByKind = async (
  kind: Kind,
  loc: Location,
  home: string,
): Promise<AnyEntity[]> => {
  switch (kind) {
    case 'agent':
      return readAgents(loc)
    case 'command':
      return readCommands(loc)
    case 'skill':
      return readSkills(loc)
    case 'rule':
      return readRules(loc)
    case 'hook':
      return readHooks(loc)
    case 'mcp':
      return readMcpServers(loc, home)
    case 'plugin':
      return readPlugins(loc, home)
    case 'marketplace':
      return readMarketplaces(loc, home)
    case 'claudemd':
      return readClaudeMds(loc)
    case 'memory':
      return readMemories(loc, home)
    case 'conversation':
      return (await readConversations(loc, home)).entities
    case 'catalog':
      return readCatalog(loc, home)
  }
}

export interface WriteContext {
  loc: Location
  home: string
}

export const writeEntity = async (
  ctx: WriteContext,
  entity: Entity<any>,
  nextValue: any,
): Promise<void> => {
  switch (entity.kind) {
    case 'agent':
      await writeAgent(ctx.loc, entity, nextValue)
      return
    case 'command':
      await writeCommand(ctx.loc, entity, nextValue)
      return
    case 'skill':
      await writeSkill(ctx.loc, entity, nextValue)
      return
    case 'rule':
      await writeRule(ctx.loc, entity, nextValue)
      return
    case 'hook':
      await writeHook(ctx.loc, entity, nextValue)
      return
    case 'mcp':
      await writeMcpServer(ctx.loc, ctx.home, entity, nextValue)
      return
    case 'plugin':
      await writePlugin(ctx.loc, ctx.home, entity, nextValue)
      return
    case 'marketplace':
      await writeMarketplace(ctx.loc, ctx.home, entity, nextValue)
      return
    case 'claudemd':
      await writeClaudeMd(ctx.loc, entity, nextValue)
      return
    case 'memory':
      await writeMemoryEntry(ctx.loc, ctx.home, entity, nextValue)
      return
    case 'conversation':
      return
    case 'catalog':
      return
  }
}

export const createEntity = async (
  ctx: WriteContext,
  kind: Kind,
  value: any,
): Promise<void> => {
  switch (kind) {
    case 'agent':
      await writeAgent(ctx.loc, null, value)
      return
    case 'command':
      await writeCommand(ctx.loc, null, value)
      return
    case 'skill':
      await writeSkill(ctx.loc, null, value)
      return
    case 'rule':
      await writeRule(ctx.loc, null, value)
      return
    case 'hook':
      await writeHook(ctx.loc, null, value)
      return
    case 'mcp':
      await writeMcpServer(ctx.loc, ctx.home, null, value)
      return
    case 'plugin':
      await writePlugin(ctx.loc, ctx.home, null, value)
      return
    case 'marketplace':
      await writeMarketplace(ctx.loc, ctx.home, null, value)
      return
    case 'claudemd':
      await writeClaudeMd(ctx.loc, null, value)
      return
    case 'memory':
      await writeMemoryEntry(ctx.loc, ctx.home, null, value)
      return
    case 'conversation':
      await writeConversation(ctx.loc, ctx.home, value)
      return
    case 'catalog':
      return
  }
}

export const deleteEntity = async (
  ctx: WriteContext,
  entity: Entity<any>,
): Promise<void> => {
  switch (entity.kind) {
    case 'agent':
      await deleteAgent(ctx.loc, entity)
      return
    case 'command':
      await deleteCommand(ctx.loc, entity)
      return
    case 'skill':
      await deleteSkill(ctx.loc, entity)
      return
    case 'rule':
      await deleteRule(ctx.loc, entity)
      return
    case 'hook':
      await deleteHook(ctx.loc, entity)
      return
    case 'mcp':
      await deleteMcpServer(ctx.loc, ctx.home, entity)
      return
    case 'plugin':
      await deletePlugin(ctx.loc, ctx.home, entity)
      return
    case 'marketplace':
      await deleteMarketplace(ctx.loc, ctx.home, entity)
      return
    case 'claudemd':
      await deleteClaudeMd(ctx.loc, entity)
      return
    case 'memory':
      await deleteMemoryEntry(ctx.loc, ctx.home, entity)
      return
    case 'conversation':
      await deleteConversation(entity)
      return
    case 'catalog':
      return
  }
}
