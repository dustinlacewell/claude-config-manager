import type { Kind } from '@/ontology'
import type { UiDescriptor } from './types'
import { agentDescriptor } from './agent'
import { commandDescriptor } from './command'
import { skillDescriptor } from './skill'
import { ruleDescriptor } from './rule'
import { hookDescriptor } from './hook'
import { mcpDescriptor } from './mcp'
import { pluginDescriptor } from './plugin'
import { marketplaceDescriptor } from './marketplace'
import { claudemdDescriptor } from './claudemd'
import { memoryDescriptor } from './memory'
import { conversationDescriptor } from './conversation'
import { catalogDescriptor } from './catalog'

export * from './types'
export * from './knowledge'

export const descriptors: Record<Kind, UiDescriptor<any>> = {
  claudemd: claudemdDescriptor,
  memory: memoryDescriptor,
  agent: agentDescriptor,
  command: commandDescriptor,
  skill: skillDescriptor,
  rule: ruleDescriptor,
  hook: hookDescriptor,
  mcp: mcpDescriptor,
  plugin: pluginDescriptor,
  marketplace: marketplaceDescriptor,
  conversation: conversationDescriptor,
  catalog: catalogDescriptor,
}

export const descriptorFor = <T = any>(kind: Kind): UiDescriptor<T> =>
  descriptors[kind] as UiDescriptor<T>
