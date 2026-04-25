# Architecture Guide

CCM is a Tauri v2 desktop app that manages Claude Code configuration files. It reads, edits, and watches config artifacts across user-global (`~/.claude/`) and per-project (`.claude/`) scopes, presenting them in a unified three-pane interface.

## System Boundary

```
+----------------------------------------------------------+
|  Tauri Window (React 19 + Vite 6)                        |
|                                                          |
|  +--------+  +-----------+  +----------+                 |
|  |Sidebar |  | List Pane |  | Edit Pane|  (App Shell)    |
|  +--------+  +-----------+  +----------+                 |
|       |            |              |                       |
|  +----v------------v--------------v----+                  |
|  |           Zustand Store             |                  |
|  +----+--------+----------+-----------++                  |
|       |        |          |            |                  |
|  +----v--+ +---v----+ +--v------+ +---v----------+       |
|  |Ontology| |Adapters| | Engine  | |UI Descriptors|      |
|  +--------+ +---+----+ +---------+ +--------------+      |
|                 |                                         |
+-----------------|-----------------------------------------+
                  | IPC (invoke / listen)
+-----------------v-----------------------------------------+
|  Rust Backend (src-tauri/)                                |
|  - Async FS ops (tokio)                                  |
|  - File watcher (notify crate)                           |
|  - Parallel project scanner (ignore crate)               |
|  - CLI bridge (spawns `claude` binary)                   |
+----------------------------------------------------------+
                  |
                  v
        ~/.claude/   .claude/   .mcp.json   ~/.claude.json
```

## Layer Contracts

### 1. Ontology (`src/ontology/`)

The domain model. Every config artifact type has:

- A **Zod schema** that defines its shape and provides runtime validation
- A **TypeScript type** inferred from the schema (`type T = z.infer<typeof T>`)
- An **`emptyT()` factory** for creating new instances with sensible defaults
- A **`KindSpec<T>`** registration that tells the rest of the system how to identify, name, search, and scope the type

The `Kind` enum is the universal discriminator:

```
claudemd | memory | agent | command | skill | rule | hook | mcp | plugin | marketplace | conversation
```

Each kind declares which scopes it supports via `KindSpec.validScopes`:
- `['user', 'project']` — most kinds (agents, commands, hooks, etc.)
- `['user']` — plugins, marketplaces (global-only)
- `['project']` — memories (per-project only)

The `Entity<T>` wrapper is the universal container:

```typescript
interface Entity<T> {
  id: string       // Globally unique: `<kind>:<scope>:<name>`
  kind: Kind
  scope: Scope     // { type: 'user' } | { type: 'project', projectId }
  path: string     // Absolute filesystem path to the backing file
  value: T         // Current in-memory value (may differ from disk)
  origin: T        // Value at load time (used for rename/delete identity)
  raw: string      // Original file contents
  error?: string   // Parse error, if any
  dirty?: boolean  // True while an unsaved edit is pending
}
```

The `origin` vs `value` distinction is critical: when a user renames an agent from "reviewer" to "auditor", adapters use `entity.origin.name` to locate the old file and `entity.value.name` for the new one.

### 2. Adapters (`src/adapters/`)

The I/O layer. Each kind has a dedicated adapter file implementing three operations:

| Operation | Signature | Purpose |
|-----------|-----------|---------|
| `read*` | `(loc, home?) => Entity<T>[]` | List all entities of this kind for a scope |
| `write*` | `(loc, home?, original, next) => void` | Create (original=null) or update an entity |
| `delete*` | `(loc, home?, entity) => void` | Remove an entity from disk |

Adapters are wired together through `adapters/index.ts`, which exposes three dispatch functions (`readByKind`, `writeEntity`, `createEntity`, `deleteEntity`) that switch on `Kind`.

**Two adapter families exist:**

1. **Markdown adapters** (agent, command, skill, rule, memory, claudemd): Use the shared `readMarkdownDir` / `writeMarkdown` helpers. Files are YAML-frontmatter markdown parsed by `frontmatter.ts`.

2. **JSON adapters** (hook, mcp, plugin, marketplace, conversation): Read/write JSON files directly. Hooks and MCP servers are embedded inside larger JSON files (settings.json, .mcp.json, .claude.json) — the adapter reads the whole file, patches the relevant section, and writes it back.

**Shared infrastructure:**

- `fs.ts` — Thin wrapper over Tauri IPC. Every FS call goes through `invoke()`. Write operations call `recordSelfWrite()` before invoking Rust so the watcher can suppress echoes.
- `selfWrites.ts` — Tracks recently-written paths with a 2-second TTL window. The watcher checks `isRecentSelfWrite()` to avoid reload loops.
- `frontmatter.ts` — YAML frontmatter parser/serializer. Tolerates BOM, empty frontmatter, and parse errors (returns `{}` on bad YAML).
- `markdown.ts` — Generic read/write for directories of frontmatter-markdown files. Includes file-stamp caching via the registry's `fileCache`.
- `paths.ts` — All path computation is centralized here: `claudeDir()`, `agentsDir()`, `settingsPath()`, etc.

### 3. Registry (`src/registry/`)

State that lives outside the entity model: project lists, UI persistence, caches.

| Module | Purpose |
|--------|---------|
| `projects.ts` | Reads `~/.claude.json` to discover projects; add/remove manual entries |
| `uiState.ts` | Persists sidebar selection, last scope/kind to `~/.config/ccm/ui-state.json` |
| `settings.ts` | App settings (API key, markdown mode) in `~/.config/ccm/config.json` |
| `watchPaths.ts` | Computes which directories to watch for a given scope |
| `persistentCache.ts` | Generic mtime/size-stamped cache persisted to disk; versioned schema |
| `fileCache.ts` | In-memory cache for parsed markdown entities (keyed by path + stamp) |
| `conversationMetaCache.ts` | Persistent cache for conversation metadata (title, turns, tokens) |
| `conversationCache.ts` | In-memory LRU for parsed conversation messages |
| `toolResultCache.ts` | In-memory cache for lazy-loaded tool_result blocks |
| `tokenCache.ts` | Persistent cache for per-conversation token counts |

The persistent cache system (`persistentCache.ts`) is designed for cross-session survival. It stores entries as `{ mtime, size, value }` tuples in JSON files under `~/.config/ccm/`. A `CACHE_VERSION` integer forces a full rebuild when the stored shape changes between releases.

### 4. Engine (`src/engine/`)

Cross-entity analysis and operations.

**Reference graph** (`engine/refs/`): Builds a directed graph of references between entities. Each kind can register a `ReferenceExtractor` that emits `RawRef` objects. The graph builder resolves these against an entity index and marks unresolvable references as `broken: true`. The UI uses this to show "Referenced by" / "References" panels and warn about broken links.

Reference sources are typed for provenance:
- `frontmatter` — a YAML field explicitly names another entity
- `import` — an `@` import path in markdown
- `tool` — a tool name that matches an MCP server
- `matcher` — a hook matcher pattern that matches a tool/entity name
- `prose` — a name found in the body text (lowest confidence)

**Validation** (`engine/validate.ts`): Generic Zod validation wrapper. Returns structured `{ ok, value?, errors[] }` results.

**Copy** (`engine/copy.ts`): Cross-scope entity duplication. Delegates to `createEntity` on the target scope.

### 5. UI Primitives (`src/ui-primitives/`)

Reusable, kind-agnostic components:

| Component | Purpose |
|-----------|---------|
| `Field` | Labeled form field wrapper |
| `InlineText` | Inline editable text field |
| `InlineSelect` | Inline dropdown |
| `InlineTags` | Tag/chip input for string arrays |
| `KeyValueEditor` | Editable key-value pairs (for env vars, etc.) |
| `ArrayEditor` | Ordered list editor with add/remove/reorder |
| `Switch` | Toggle switch |
| `ProseEditor` | CodeMirror 6 markdown editor |
| `Inspector` | Right-pane entity inspector with header, refs, editor |
| `CommandPalette` | `cmdk`-based global command palette |
| `ContextMenu` | Right-click context menu system |
| `PromptDialog` | Text-input dialog for entity creation |
| `ScanDialog` | Folder-scanning dialog for project discovery |
| `SettingsDialog` | App settings modal |
| `ExternalLink` | Clickable link that opens URLs/paths via OS handler |
| `FilePath` | Click-to-copy file path display |
| `ColorDot` | Small colored circle indicator |
| `List` | Virtualized list with search, tabs, drag support |

The `markdown/` subdirectory contains the markdown rendering pipeline:
- `MarkdownView` — react-markdown with remark-gfm and custom GitHub-style alert plugin
- `CodeBlock` — Shiki-highlighted code blocks with async language loading
- `shikiSync.ts` — Synchronous tokenizer with LRU cache for inline highlighting
- `shiki.ts` — Async highlighter with per-language lazy loading and HTML cache
- `alerts.ts` — Custom remark plugin for `> [!NOTE]` / `> [!WARNING]` callouts
- `FrontmatterPanel` — Renders parsed frontmatter as a styled key-value table

### 6. UI Descriptors (`src/ui-descriptors/`)

Per-kind configuration that maps domain types to UI components. Each kind implements a `UiDescriptor<T>`:

```typescript
interface UiDescriptor<T> {
  kind: Kind
  newDefault: (name: string) => T        // Factory for "New" dialog
  newLabel: string                        // "New Agent"
  newPromptLabel: string                  // "Agent name"
  listLabel: (v: T) => ReactNode         // What to show in the list pane
  listSublabel?: (v: T) => ReactNode     // Secondary text in list
  headerTitle?: (v: T) => ReactNode      // Inspector header override
  headerSubtitle?: (v: T) => ReactNode   // Subtitle override
  tabs?: ListTab<T>[]                    // Optional tab strip
  canDelete?: (v: T) => boolean          // Suppress delete for certain items
  Editor: React.ComponentType<...>       // The edit form itself
  customActions?: (...)                   // Context menu items
  headerActions?: (...)                   // Inspector header buttons
}
```

This is the extension point for adding new entity kinds to the UI without modifying the shell.

### 7. App Shell (`src/app/`)

The top-level orchestration layer:

- **`store.ts`** — Zustand store. Single source of truth for all app state. Handles bootstrap, scope switching, entity CRUD, debounced writes, watcher integration, and progressive conversation enrichment.
- **`shell/Shell.tsx`** — Root component. Three-pane layout (Sidebar, ListPane, EditPane) plus command palette, context menu, settings dialog, and toast host.
- **`shell/Sidebar.tsx`** — Project selector + kind navigation with entity counts and loading spinners.
- **`shell/ListPane.tsx`** — Filtered, searchable entity list with tabs and drag-to-copy.
- **`shell/EditPane.tsx`** — Inspector wrapper that renders the active kind's `Editor` component.
- **`palette/`** — Command palette action builder.
- **`cliOp.ts`** — Wrapper for CLI operations with toast feedback, pending-op tracking, and auto-reload.
- **`updater.ts`** — Tauri auto-update integration.

### 8. Rust Backend (`src-tauri/`)

Intentionally thin. The Rust layer provides capabilities the browser sandbox cannot:

| Command | Purpose |
|---------|---------|
| `home_dir` | Returns `$HOME` |
| `read_text` / `write_text` | File I/O with auto-mkdir |
| `read_json` / `write_json` | JSON I/O with pretty-print |
| `path_exists` / `ensure_dir` / `remove_path` / `rename_path` | FS operations |
| `list_dir` / `list_dir_recursive` | Directory listing with mtime/size stamps |
| `find_files_named` | Parallel, gitignore-aware file search (uses `ignore` crate) |
| `scan_for_projects` | Parallel scanner for `.claude/` and `CLAUDE.md` markers |
| `watch_paths` / `unwatch_all` | File watcher (uses `notify` crate) |
| `run_claude_cli` | Spawn the `claude` binary with timeout |
| `open_external` | Open URL/path with OS default handler |

All FS commands are async (tokio). The watcher emits `fs:change` events to the frontend via Tauri's event system. The parallel walkers (`find_files_named`, `scan_for_projects`) use the `ignore` crate's `WalkBuilder` with `build_parallel()` and skip a hardcoded set of directories (node_modules, target, .git, dist, build, etc.).

## Data Flow

### Bootstrap Sequence

```
1. Shell mounts → calls store.bootstrap()
2. bootstrap():
   a. Resolve home directory (Rust: home_dir)
   b. In parallel:
      - Load project list from ~/.claude.json
      - Initialize token cache from disk
      - Initialize persistent caches from disk
   c. Load UI state (last scope, kind, selections)
   d. Load app settings
   e. Restore scope + kind from UI state
   f. Call reload() — reads all entity kinds for the active scope
   g. Start file watcher on computed watch targets
   h. Register fs:change listener
   i. Set ready = true
```

### Entity Edit Flow

```
1. User types in Editor component
2. Editor calls onChange(nextValue)
3. store.updateEntity(entity, nextValue):
   a. Optimistic update: set entity.value = next, entity.dirty = true
   b. Cancel any pending debounce timer for this entity
   c. Start new 350ms debounce timer
4. After 350ms, debounce fires:
   a. Read current entity.value from store (may have changed again)
   b. Call adapterWrite(ctx, entity, value) — writes to disk via Rust IPC
   c. If value hasn't changed since write started, clear dirty flag + update origin
5. Rust write triggers notify watcher → fs:change event
6. selfWrites check suppresses the echo → no reload
```

### External Change Flow

```
1. External tool modifies a config file
2. notify crate fires → Rust emits fs:change event
3. Store's onChange handler:
   a. Invalidate persistent caches for changed paths
   b. Check isRecentSelfWrite() — skip if it's our own echo
   c. Add paths to pendingRefreshPaths set
   d. Debounce 150ms → flushPendingRefresh()
4. flushPendingRefresh():
   a. Map changed paths to affected Kinds via kindsForPath()
   b. Call refreshKinds(affectedKinds)
5. refreshKinds():
   a. Re-read only the affected kind buckets from disk
   b. Merge with in-memory state, preserving dirty entities
   c. Update reference graph
   d. Single setState() call → one UI re-render
```

### Conversation Loading

Conversations use a two-phase progressive loading strategy:

```
Phase 1 (immediate): readConversations()
  - List .jsonl files in project directory
  - For each file, check persistent cache by (mtime, size)
  - Cache hit → use cached metadata (title, turns, tokens)
  - Cache miss → create skeleton entity (sessionId only)
  - Return entities + list of enrichment jobs for cache misses

Phase 2 (background): runEnrichment()
  - Process jobs with bounded concurrency (8 workers)
  - Each worker: parse .jsonl, extract metadata, update cache
  - Push enriched entities to store one-at-a-time
  - Abort if user switches scope (isCurrent() check)
```

## Scope Model

CCM operates in two scope types:

| Scope | Root | Config Dir | Description |
|-------|------|-----------|-------------|
| `user` | `$HOME` | `~/.claude/` | Global user configuration |
| `project` | project path | `{project}/.claude/` | Per-project configuration |

The sidebar's project selector switches scope. When scope changes:
1. All entity buckets are emptied
2. Loading spinners appear for every kind
3. File watcher is rewired to the new scope's directories
4. All kinds are re-read in parallel
5. UI state (last scope) is persisted

Claude's own project encoding scheme (`path.replace(/[\/\\:]/g, '-')`) maps project paths to directory names under `~/.claude/projects/`. This is used for memories and conversations.

## Caching Strategy

Four cache layers minimize redundant I/O:

| Layer | Scope | Key | Storage | Eviction |
|-------|-------|-----|---------|----------|
| File cache | in-memory | path + (mtime, size) | Map | Invalidated by watcher |
| Conversation meta cache | persistent | path + (mtime, size) | JSON file | Stamp mismatch + watcher |
| Token cache (Shiki) | in-memory | lang + line content | Map (2000 limit) | FIFO at limit |
| Conversation message cache | in-memory | file path | Map | Invalidated by watcher |

The persistent cache system uses a version integer (`CACHE_VERSION = 2`). When the stored version doesn't match, the cache is treated as empty and rebuilt on next use. This prevents crashes from schema changes between releases.
