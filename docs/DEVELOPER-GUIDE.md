# Developer Guide

Practical guidance for extending and maintaining CCM.

## Setup

```bash
# Prerequisites: Node.js 20+, Rust 1.77+, system deps for Tauri v2
npm install
npm run tauri:dev    # Starts Rust backend + Vite dev server with HMR
```

For UI-only iteration (no Rust rebuild on each change):

```bash
npm run dev          # Vite only — Tauri IPC calls will fail, but layout/styling work
```

Type-check without building:

```bash
npx tsc --noEmit
```

## Adding a New Config Kind

This is the most common extension task. Follow these 8 steps in order.

### Step 1: Define the Zod schema

Create `src/ontology/{kind}.ts`:

```typescript
import { z } from 'zod'

export const Widget = z.object({
  name: z.string().min(1),
  color: z.string().default('blue'),
  body: z.string().default(''),
})
export type Widget = z.infer<typeof Widget>

export const emptyWidget = (name: string): Widget => ({
  name,
  color: 'blue',
  body: '',
})
```

Rules:
- Every kind must have a `name` field (used for identity and display)
- Provide sensible `.default()` values on all optional fields
- Export an `empty*` factory for the "New" dialog

### Step 2: Register the kind

In `src/ontology/core.ts`, add the kind string to the `Kind` enum:

```typescript
export const Kind = z.enum([
  // ...existing kinds...
  'widget',
])
```

In `src/ontology/index.ts`:
1. Import and re-export the new schema file
2. Create a `KindSpec<Widget>`:

```typescript
export const widgetSpec: KindSpec<Widget> = {
  kind: 'widget',
  label: 'Widget',
  pluralLabel: 'Widgets',
  schema: Widget,
  validScopes: ['user', 'project'],  // or ['user'] for global-only
  idOf: (v) => v.name,
  nameOf: (v) => v.name,
  searchText: (v) => `${v.name} ${v.color} ${v.body}`.toLowerCase(),
}
```

3. Add to `kindSpecs` record and `allKinds` array

### Step 3: Write the adapter

Create `src/adapters/{kind}Adapter.ts`.

**For markdown-based kinds** (files in a dedicated directory):

```typescript
import { Widget, type Entity } from '@/ontology'
import { readMarkdownDir, writeMarkdown } from './markdown'
import { join, fs } from './fs'
import { claudeDir, type Location } from './paths'

const widgetsDir = (loc: Location): string => join(claudeDir(loc), 'widgets')

const clean = (s: string): string =>
  s.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')

export const readWidgets = (loc: Location): Promise<Entity<Widget>[]> =>
  readMarkdownDir({
    dir: widgetsDir(loc),
    scope: loc.scope,
    kind: 'widget',
    build: ({ rawData, body, fileName }) =>
      Widget.parse({
        name: (rawData.name as string) ?? fileName,
        color: rawData.color as string | undefined,
        body,
      }),
    idOf: (v) => v.name,
  })

export const writeWidget = async (
  loc: Location,
  original: Entity<Widget> | null,
  next: Widget,
): Promise<void> => {
  const nextPath = join(widgetsDir(loc), `${clean(next.name)}.md`)
  if (original && original.path !== nextPath) {
    if (await fs.pathExists(original.path)) await fs.removePath(original.path)
  }
  const { body, ...fm } = next
  await writeMarkdown(nextPath, fm as Record<string, unknown>, body)
}

export const deleteWidget = async (
  _loc: Location,
  entity: Entity<Widget>,
): Promise<void> => {
  if (await fs.pathExists(entity.path)) await fs.removePath(entity.path)
}
```

**For JSON-embedded kinds** (stored inside a larger JSON file), follow the pattern in `hookAdapter.ts` or `mcpAdapter.ts`.

### Step 4: Wire the adapter

In `src/adapters/index.ts`, add the new adapter to all three dispatch functions:

```typescript
import { readWidgets, writeWidget, deleteWidget } from './widgetAdapter'

// In readByKind:
case 'widget': return readWidgets(loc)

// In writeEntity:
case 'widget': await writeWidget(ctx.loc, entity, nextValue); return

// In createEntity:
case 'widget': await writeWidget(ctx.loc, null, value); return

// In deleteEntity:
case 'widget': await deleteWidget(ctx.loc, entity); return
```

Also add to `readAll()`.

If the kind needs path-based watcher routing, add mapping rules in `paths.ts` → `kindsForPath()`.

### Step 5: Add the store bucket

In `src/app/store.ts`:

```typescript
interface EntitiesByKind {
  // ...existing...
  widget: Entity<any>[]
}

const emptyBuckets = (): EntitiesByKind => ({
  // ...existing...
  widget: [],
})
```

### Step 6: Create the UI descriptor

Create `src/ui-descriptors/{kind}.tsx`:

```typescript
import type { UiDescriptor } from './types'
import type { Widget } from '@/ontology'
import { emptyWidget } from '@/ontology'
import { Field, InlineText, ProseEditor } from '@/ui-primitives'

function WidgetEditor({
  value,
  onChange,
}: {
  value: Widget
  onChange: (next: Widget) => void
  ctx: any
}) {
  return (
    <div className="space-y-4">
      <Field label="Name">
        <InlineText
          value={value.name}
          onChange={(name) => onChange({ ...value, name })}
        />
      </Field>
      <Field label="Color">
        <InlineText
          value={value.color}
          onChange={(color) => onChange({ ...value, color })}
        />
      </Field>
      <ProseEditor
        value={value.body}
        onChange={(body) => onChange({ ...value, body })}
      />
    </div>
  )
}

export const widgetDescriptor: UiDescriptor<Widget> = {
  kind: 'widget',
  newDefault: emptyWidget,
  newLabel: 'New Widget',
  newPromptLabel: 'Widget name',
  listLabel: (v) => v.name,
  listSublabel: (v) => v.color,
  Editor: WidgetEditor,
}
```

### Step 7: Register the descriptor

In `src/ui-descriptors/index.ts`:

```typescript
import { widgetDescriptor } from './widget'

export const descriptors: Record<Kind, UiDescriptor<any>> = {
  // ...existing...
  widget: widgetDescriptor,
}
```

### Step 8: Verify

```bash
npx tsc --noEmit     # Must pass with zero errors
npm run tauri:dev     # Visual check: new kind appears in sidebar
```

Test the full lifecycle: create, edit, rename, delete, copy-to-scope.

## Read-Only Kinds

For kinds that shouldn't be editable (like conversations):

```typescript
export const widgetSpec: KindSpec<Widget> = {
  // ...
  readOnly: true,          // Hides create/edit/delete UI
  allowScopeMove: true,    // Still allows copy/move between scopes
}
```

The shell and command palette automatically respect these flags.

## Adding Reference Extractors

To make your kind participate in the reference graph:

1. Create an extractor in `src/engine/refs/extractors/`:

```typescript
import type { ReferenceExtractor, RawRef } from '../types'

export const extractWidgetRefs: ReferenceExtractor = (entity, ctx) => {
  const refs: RawRef[] = []
  const value = entity.value as Widget

  // Example: reference agents mentioned in the body
  for (const agentName of ctx.namesByKind('agent')) {
    if (value.body.includes(agentName)) {
      refs.push({
        toKind: 'agent',
        toName: agentName,
        source: { kind: 'prose' },
      })
    }
  }

  return refs
}
```

2. Register it in `src/engine/refs/extractors/index.ts`:

```typescript
export const referenceExtractors: Partial<Record<Kind, ReferenceExtractor>> = {
  // ...existing...
  widget: extractWidgetRefs,
}
```

3. Add the kind to `kindsThatCanBeReferenced` in `queries.ts` if other kinds can reference it.

## Custom Context Menu Actions

Add actions to the entity context menu or inspector header:

```typescript
export const widgetDescriptor: UiDescriptor<Widget> = {
  // ...
  customActions: (entity, ctx) => [
    {
      label: 'Duplicate',
      action: () => ctx.createIn('widget', { ...entity.value, name: `${entity.value.name}-copy` }, ctx.scope),
    },
  ],
  headerActions: (entity, ctx) => [
    {
      label: entity.value.enabled ? 'Disable' : 'Enable',
      action: async () => { /* toggle logic */ },
    },
  ],
}
```

`customActions` appear in the right-click context menu. `headerActions` render as buttons in the inspector header.

## CLI Operations

For actions that shell out to the `claude` CLI, use the `runCliOp` wrapper:

```typescript
import { runCliOp, useIsOpPending } from '@/app/cliOp'

const installWidget = (name: string) =>
  runCliOp({
    key: `install:${name}`,
    loading: `Installing ${name}...`,
    success: `${name} installed`,
    action: async () => {
      const result = await fs.runClaudeCli(['widget', 'install', name])
      if (result.exit_code !== 0) throw new Error(result.stderr)
      return result
    },
  })

// In a component:
const pending = useIsOpPending(`install:${name}`)
// → renders spinner while true
```

`runCliOp` handles: pending-op tracking, loading/success/error toasts, and automatic store reload on completion.

## File Watching

The watcher pipeline:

```
Rust notify → fs:change event → store onChange handler
  → invalidate caches
  → filter self-writes
  → accumulate paths (pendingRefreshPaths)
  → debounce 150ms → flushPendingRefresh()
    → kindsForPath() maps paths to kinds
    → refreshKinds() re-reads only affected buckets
    → mergeBucket() preserves dirty entities
    → single setState() → one UI render
```

When adding a new kind, ensure `kindsForPath()` in `paths.ts` returns your kind for the relevant file paths. Otherwise, external changes to your kind's files won't trigger a refresh.

## Debounce Timing

| Timer | Delay | Purpose |
|-------|-------|---------|
| Entity write | 350ms | Coalesce rapid keystrokes before writing to disk |
| Watcher refresh | 150ms | Coalesce burst file events into one reload |
| UI state save | 250ms | Avoid thrashing on rapid scope/kind switches |
| Settings save | 300ms | Debounce settings dialog changes |
| Persistent cache flush | 500ms | Batch cache writes during enrichment sweeps |

## Persistent Cache Versioning

If you change the shape of any cached value (e.g., adding a field to `ConversationMeta`), bump `CACHE_VERSION` in `persistentCache.ts`. This forces a full cache rebuild on next launch. Without this, users who upgrade will crash when code tries to read the old format.

## Testing Patterns

The app has two FS implementations:
- `fs.ts` — real Tauri IPC (used in `npm run tauri:dev`)
- `fs.demo.ts` — in-memory mock with fixture data (used in `npm run dev`)

The demo adapter is selected at build time. To add demo data for a new kind, add entries to `fs.demo.fixture.ts`.

## Key Invariants

1. **`origin` is identity**: Adapters must use `entity.origin` (not `entity.value`) to locate the backing file on disk. If the user renames a field and then saves, the adapter needs the old name to find the old file.

2. **Dirty entities survive refreshes**: `mergeBucket()` ensures that entities with `dirty: true` are not overwritten by a watcher-triggered reload. The pending debounced write will eventually sync the value to disk.

3. **Self-writes are suppressed**: Every FS write calls `recordSelfWrite()`. The watcher's `isRecentSelfWrite()` check prevents reload loops. The TTL is 2 seconds — long enough for the watcher event to propagate.

4. **Scope switches are atomic**: When the scope changes, the store empties all buckets, rewires the watcher, and starts a full reload. The `stillCurrent()` guard prevents stale reads from overwriting results if the user switches again before the reload completes.

5. **Parse errors don't crash**: Failed parses produce entities with `error` set and `value: {} as T`. These are displayed with an error indicator. The file cache does NOT persist failed parses (to avoid freezing broken state across launches).

6. **Cache version gates deserialization**: The `CACHE_VERSION` in `persistentCache.ts` must be bumped when cached value shapes change. Mismatched versions are treated as empty caches.

## Project Structure Reference

```
src/
  ontology/           # Zod schemas + types + KindSpec registrations
    core.ts           #   Kind enum, Scope, Entity<T>
    index.ts          #   KindSpec definitions, allKinds
    schema.ts         #   Shared schema utilities (LooseStringArray)
    settings.ts       #   App settings schema
    project.ts        #   Project type + helpers
    {kind}.ts         #   One file per domain type

  adapters/           # Filesystem I/O per kind
    fs.ts             #   Tauri IPC wrapper
    fs.demo.ts        #   In-memory mock for UI-only dev
    paths.ts          #   Path computation + kindsForPath
    selfWrites.ts     #   Watcher echo suppression
    frontmatter.ts    #   YAML frontmatter parser
    markdown.ts       #   Shared markdown adapter
    index.ts          #   Dispatch: readByKind, writeEntity, etc.
    {kind}Adapter.ts  #   One adapter per kind

  registry/           # State outside the entity model
    projects.ts       #   Project list management
    uiState.ts        #   UI state persistence
    settings.ts       #   App settings persistence
    watchPaths.ts     #   Watch target computation
    persistentCache.ts#   Cross-session cache framework
    fileCache.ts      #   In-memory entity cache
    conversationMetaCache.ts
    conversationCache.ts
    toolResultCache.ts
    tokenCache.ts

  engine/             # Cross-entity analysis
    refs/             #   Reference graph
      types.ts        #     Reference, RawRef, RefSource types
      graph.ts        #     buildReferenceGraph
      queries.ts      #     referrersOf, referencesFrom
      extractors/     #     Per-kind reference extractors
    validate.ts       #   Zod validation wrapper
    copy.ts           #   Cross-scope entity copy

  ui-primitives/      # Reusable, kind-agnostic components
    markdown/         #   Markdown rendering pipeline
    index.ts          #   Barrel export

  ui-descriptors/     # Per-kind UI configuration
    types.ts          #   UiDescriptor<T> interface
    index.ts          #   Descriptor registry
    {kind}.tsx        #   One descriptor per kind

  app/                # Top-level orchestration
    store.ts          #   Zustand store (state + actions)
    cliOp.ts          #   CLI operation wrapper
    updater.ts        #   Auto-update integration
    palette/          #   Command palette actions
    shell/            #   Three-pane layout components

src-tauri/
  src/
    main.rs           # Tauri entry point
    lib.rs            # Plugin + state registration
    commands.rs       # All IPC commands (FS, watcher, CLI, etc.)
  capabilities/
    default.json      # Tauri permissions (minimal: core, dialog, updater, process)
```
