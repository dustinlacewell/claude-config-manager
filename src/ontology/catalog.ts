import { z } from 'zod'

export const CatalogType = z.enum(['agent', 'skill', 'mcp'])
export type CatalogType = z.infer<typeof CatalogType>

export const CatalogEntry = z.object({
  id: z.string(),
  type: CatalogType,
  name: z.string(),
  description: z.string().default(''),
  author: z.string().default(''),
  tags: z.array(z.string()).default([]),
  installData: z.record(z.string(), z.unknown()),
  installed: z.boolean().default(false),
})
export type CatalogEntry = z.infer<typeof CatalogEntry>
