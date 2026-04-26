# API Reference

Complete reference for all public interfaces across the six layers.

---

## Ontology Layer (`src/ontology/`)

### Kind Enum

```typescript
type Kind =
  | 'claudemd' | 'memory' | 'agent' | 'command' | 'skill'
  | 'rule' | 'hook' | 'mcp' | 'plugin' | 'marketplace'
  | 'conversation'
```

### Scope

```typescript
type Scope =
  | { type: 'user' }
  | { type: 'project'; projectId: string }
```

**Utilities:**
- `scopeKey(s: Scope): string` — `'user'` or `'project:<id>'`
- `scopeEq(a: Scope, b: Scope): boolean` — structural equality via key comparison

### Entity\<T\>

The universal wrapper for all config artifacts.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Globally unique: `<kind>:<scope>:<name>` |
| `kind` | `Kind` | Discriminator |
| `scope` | `Scope` | Where this entity lives |
| `path` | `string` | Absolute filesystem path |
| `value` | `T` | Current in-memory value |
| `origin` | `T` | Value at load time (identity anchor for rename/delete) |
| `raw` | `string` | Original file contents |
| `error?` | `string` | Parse error message, if any |
| `dirty?` | `boolean` | True while unsaved edits are pending |

### KindSpec\<T\>

Registration record for each kind. Stored in the `kindSpecs` record.

| Field | Type | Description |
|-------|------|-------------|
| `kind` | `Kind` | The kind this spec describes |
| `label` | `string` | Singular display name ("Agent") |
| `pluralLabel` | `string` | Plural display name ("Agents") |
| `schema` | `ZodTypeAny` | Zod schema for runtime validation |
| `validScopes` | `ScopeType[]` | Which scopes this kind exists in |
| `targetableScopes?` | `ScopeType[]` | Scopes valid as copy/move targets (defaults to `validScopes`) |
| `readOnly?` | `boolean` | Suppress all edit UI |
| `allowScopeMove?` | `boolean` | Allow move/copy even when readOnly |
| `noCreate?` | `boolean` | Suppress "New" button |
| `idOf` | `(v: T) => string` | Extract unique id from value |
| `nameOf` | `(v: T) => string` | Extract display name from value |
| `searchText` | `(v: T) => string` | Text blob for search matching |

**Lookup functions:**
- `kindSupportsScope(kind, scope): boolean`
- `kindTargetableScopes(kind): readonly ScopeType[]`
- `allKindsForScope(scope): Kind[]`

### Domain Types

#### Agent
```typescript
{
  name: string          // min 1 char
  description: string   // default ''
  tools?: string[]      // allowed tools (LooseStringArray)
  model?: 'sonnet' | 'opus' | 'haiku' | 'inherit'
  color?: string        // hex color for UI dot
  body: string          // markdown content
}
```

#### Command
```typescript
{
  name: string
  path: string          // subpath within commands/ (default '')
  description: string
  argumentHint?: string
  allowedTools?: string[]
  model?: 'sonnet' | 'opus' | 'haiku' | 'inherit'
  body: string
}
```

#### Skill
```typescript
{
  name: string
  description: string
  license?: string
  allowedTools?: string[]
  body: string
}
```

#### Rule
```typescript
{
  name: string
  path: string          // subpath within rules/ (default '')
  description: string
  paths?: string[]      // file path filters
  body: string
}
```

#### Hook
```typescript
{
  event: HookEvent      // PreToolUse | PostToolUse | UserPromptSubmit | Notification | Stop | SubagentStop | SessionStart | PreCompact
  matcher: string       // tool/pattern matcher (default '')
  index: number         // position within the event's handler array
  handlers: HookHandler[]
}

// HookHandler:
{
  type: 'command'
  command: string
  timeout?: number      // positive integer, milliseconds
}
```

#### McpServer
```typescript
{
  name: string
  type: 'stdio' | 'sse' | 'http'   // default 'stdio'
  command: string
  args: string[]
  env: Record<string, string>
  url?: string                       // for sse/http transports
  enabled: boolean
}
```

#### Plugin
```typescript
{
  name: string
  marketplace: string
  state: 'installed' | 'available' | 'both'
  version?: string
  scope?: 'user' | 'project' | 'project-local'
  installPath?: string
  installedAt?: string
  lastUpdated?: string
  enabled: boolean
  manifestFound: boolean
  description?: string
  author?: { name?, email?, url? }
  repository?: string
  homepage?: string
  keywords: string[]
  license?: string
  category?: string
  source?: unknown
}
```

**Utilities:**
- `pluginKey(p): string` — `'<name>@<marketplace>'`
- `isInstalled(p): boolean`
- `isAvailable(p): boolean`

#### Marketplace
```typescript
{
  name: string
  source: MarketplaceSourceObject | string
  installLocation?: string
  lastUpdated?: string
}
```

Source types: `github` (repo, ref?, sha?), `url` (url, ref?, sha?), `git-subdir` (url, path, ref?), `path` (path), or raw string.

- `formatMarketplaceSource(s): string` — human-readable display

#### ClaudeMd
```typescript
{
  name: string       // display name
  relPath: string    // path relative to .claude/ or project root
  body: string       // markdown content
}
```

#### Memory
```typescript
{
  name: string
  description: string
  type: 'user' | 'feedback' | 'project' | 'reference'
  body: string
}
```

**Utilities:**
- `claudeProjectEncoding(projectPath): string` — `path.replace(/[\/\\:]/g, '-')`
- `memorySlug(name): string` — lowercase, non-alnum → `_`, trimmed

#### Conversation
```typescript
{
  sessionId: string
  title: string
  startTime: string      // ISO timestamp
  lastTime: string       // ISO timestamp
  turnCount: number
  tokenCount?: number
  projectDir: string     // encoded project directory name
  filePath: string       // absolute path to .jsonl file
}
```

#### CatalogEntry
```typescript
{
  id: string                              // 'agent:code-reviewer' or 'skillssh:owner/repo/slug'
  type: 'agent' | 'skill' | 'mcp'        // what kind of entity this installs as
  name: string
  description: string
  author: string
  tags: string[]
  installData: Record<string, unknown>    // value passed to createEntity (or repo+slug for skills.sh)
  installed: boolean                      // computed at read time by checking disk
}
```

Bundled entries have `installData` matching the target kind's schema (Agent, Skill, or McpServer). Skills.sh entries have `installData: { repo, slug }` and install via the `skills` CLI.

#### Project
```typescript
{
  id: string        // projectIdOf(path)
  path: string      // absolute filesystem path
  name: string      // last path segment
  exists: boolean   // whether the path exists on disk
}
```

#### Settings
```typescript
{
  anthropic: { apiKey: string }
  markdownDefaultMode: 'edit' | 'read'
  checkUpdatesOnStartup: boolean
  markedPlugins: string[]     // plugin ids flagged for update
}
```

### Schema Utilities

#### LooseStringArray

Zod preprocessor that normalizes both `string` and `string[]` inputs to `string[]`. Splits comma-separated strings, trims whitespace, drops empty entries.

```typescript
LooseStringArray.parse("Read, Write, Edit")  // → ["Read", "Write", "Edit"]
LooseStringArray.parse(["Read", "Write"])     // → ["Read", "Write"]
LooseStringArray.parse("")                     // → []
```

---

## Adapter Layer (`src/adapters/`)

### FS Bridge (`fs.ts`)

All filesystem operations go through this module. Each method wraps a Tauri `invoke()` call.

| Method | Signature | Description |
|--------|-----------|-------------|
| `fs.homeDir` | `() => Promise<string>` | User's home directory |
| `fs.readText` | `(path) => Promise<string>` | Read file as UTF-8 |
| `fs.writeText` | `(path, contents) => Promise<void>` | Write file (auto-creates parents) |
| `fs.readJson` | `<T>(path) => Promise<T>` | Read + parse JSON |
| `fs.writeJson` | `(path, value) => Promise<void>` | Serialize + write JSON (pretty) |
| `fs.pathExists` | `(path) => Promise<boolean>` | Check existence |
| `fs.ensureDir` | `(path) => Promise<void>` | `mkdir -p` |
| `fs.removePath` | `(path) => Promise<void>` | Delete file or directory |
| `fs.renamePath` | `(from, to) => Promise<void>` | Rename/move |
| `fs.listDir` | `(path) => Promise<DirEntry[]>` | List directory (shallow) |
| `fs.listDirRecursive` | `(path, maxDepth?) => Promise<DirEntry[]>` | Recursive listing |
| `fs.findFilesNamed` | `(root, name, maxDepth?) => Promise<DirEntry[]>` | Parallel gitignore-aware search |
| `fs.watchPaths` | `(paths) => Promise<void>` | Start watching (replaces previous) |
| `fs.unwatchAll` | `() => Promise<void>` | Stop all watchers |
| `fs.scanForProjects` | `(root, maxDepth?) => Promise<ProjectHit[]>` | Find directories with `.claude/` or `CLAUDE.md` |
| `fs.onChange` | `(cb) => Promise<UnlistenFn>` | Subscribe to `fs:change` events |
| `fs.runClaudeCli` | `(args, timeoutMs?) => Promise<CliResult>` | Spawn `claude` CLI |
| `fs.openExternal` | `(target) => Promise<void>` | Open URL/path with OS handler |

Write operations (`writeText`, `writeJson`, `removePath`, `renamePath`) automatically call `recordSelfWrite()` to suppress watcher echoes.

**Convenience functions:**
- `readTextOrNull(path): Promise<string | null>` — returns null on read failure
- `readJsonOrNull<T>(path): Promise<T | null>` — returns null on read/parse failure

**Path utilities:**
- `join(...parts): string` — path join with `/` normalization
- `basename(p): string` — last segment
- `dirname(p): string` — parent path
- `stripExt(name, ext): string` — remove extension suffix

### DirEntry

```typescript
{
  name: string     // filename
  path: string     // absolute path
  is_dir: boolean
  is_file: boolean
  mtime: number    // ms since epoch; 0 if unavailable
  size: number     // bytes; 0 for directories
}
```

### Paths (`paths.ts`)

Centralized path computation for all config locations.

| Function | Returns |
|----------|---------|
| `claudeDir(loc)` | `{root}/.claude` |
| `settingsPath(loc)` | `{root}/.claude/settings.json` |
| `settingsLocalPath(loc)` | `{root}/.claude/settings.local.json` |
| `agentsDir(loc)` | `{root}/.claude/agents` |
| `commandsDir(loc)` | `{root}/.claude/commands` |
| `skillsDir(loc)` | `{root}/.claude/skills` |
| `rulesDir(loc)` | `{root}/.claude/rules` |
| `projectMcpPath(loc)` | `{root}/.mcp.json` |
| `userClaudeJson(home)` | `{home}/.claude.json` |
| `userPluginsDir(home)` | `{home}/.claude/plugins` |
| `installedPluginsPath(home)` | `{home}/.claude/plugins/installed_plugins.json` |
| `knownMarketplacesPath(home)` | `{home}/.claude/plugins/known_marketplaces.json` |

**Path analysis:**
- `kindsForPath(path, loc, home): Set<Kind>` — maps a changed path to the set of entity kinds it could affect. Used by the watcher for targeted reloads.
- `relPath(absPath, root): string` — relative path from root
- `displayEntityPath(entity, home, projects): string` — shortest meaningful display path

### Location

```typescript
interface Location {
  scope: Scope
  root: string    // absolute path to scope root (home dir or project dir)
}
```

### Self-Write Tracking (`selfWrites.ts`)

- `recordSelfWrite(path): void` — marks a path as self-written for 2 seconds
- `isRecentSelfWrite(path): boolean` — checks + lazily evicts expired entries

### Frontmatter (`frontmatter.ts`)

- `parse<T>(text): { data: T, body: string, hadFrontmatter: boolean }` — parse YAML frontmatter; tolerates BOM, returns `{}` on bad YAML
- `stringify(data, body): string` — serialize to frontmatter markdown; omits empty/null values

### Markdown Adapter (`markdown.ts`)

- `readMarkdownDir<T>(opts): Promise<Entity<T>[]>` — read a directory of `.md` files into entities using the supplied `build` function. Supports recursive reads and file-stamp caching.
- `writeMarkdown(path, data, body): Promise<void>` — serialize frontmatter + body to a file

### Dispatch Functions (`index.ts`)

- `readAll(loc, home): Promise<AnyEntity[]>` — read all 11 kinds in parallel
- `readByKind(kind, loc, home): Promise<AnyEntity[]>` — read a single kind
- `writeEntity(ctx, entity, nextValue): Promise<void>` — update an existing entity
- `createEntity(ctx, kind, value): Promise<void>` — create a new entity
- `deleteEntity(ctx, entity): Promise<void>` — remove an entity

### Conversation Adapter (`conversationAdapter.ts`)

- `readConversations(loc, home): Promise<ConversationReadResult>` — returns entities + enrichment jobs
- `enrichConversation(job): Promise<Entity<Conversation> | null>` — parse a .jsonl file for metadata
- `parseConversationMessages(filePath): Promise<ParsedMessage[]>` — cached, deduplicated message parser
- `prefetchConversation(filePath): void` — fire-and-forget background parse
- `fetchToolResults(filePath): Promise<Map<string, string>>` — lazy-load tool_result blocks

### Catalog Adapter (`catalogAdapter.ts`)

- `readCatalog(loc, home): Promise<Entity<CatalogEntry>[]>` — merges bundled entries with live skills.sh data. Checks installed status by listing agents/skills directories and reading MCP config. Write/create/delete are no-ops (catalog is read-only).

### Skills.sh Scraper (`skillsShScraper.ts`)

- `fetchSkillsSh(): Promise<CatalogEntry[]>` — fetches skills.sh HTML via `curl` (through Rust `run_command`), parses the SSR leaderboard to extract skill entries (name, repo, rank, install count). Results are cached in memory; returns `[]` on failure.
- `invalidateSkillsShCache(): void` — clears the cache so the next `fetchSkillsSh()` re-fetches.

### Token Counter (`tokenCounter.ts`)

Exported from adapters for computing token usage from conversation files.

---

## Registry Layer (`src/registry/`)

### Projects (`projects.ts`)

- `loadProjects(home): Promise<Project[]>` — reads `~/.claude.json`, returns sorted project list
- `addManualProject(home, path, name?): Promise<void>` — adds a project entry
- `removeManualProject(home, path): Promise<void>` — removes a project entry
- `resolveLocation(scope, home, projects): Location | null` — maps scope → Location

### UI State (`uiState.ts`)

- `loadUiState(home): Promise<UiState>` — reads `~/.config/ccm/ui-state.json`
- `saveUiState(home, state): Promise<void>` — persists UI state
- `scopeFromKey(key): Scope | null` — parses a scope key back to a Scope

### Settings (`settings.ts`)

- `loadSettings(home): Promise<Settings>` — reads `~/.config/ccm/config.json`
- `saveSettings(home, settings): Promise<void>` — persists settings

### Persistent Cache (`persistentCache.ts`)

```typescript
interface PersistentCache<T> {
  get(path: string, stamp: FileStamp): T | null
  set(path: string, stamp: FileStamp, value: T): void
  invalidate(path: string): void
}
```

- `createPersistentCache<T>(name): PersistentCache<T>` — register a new cache namespace
- `initPersistentCaches(home): Promise<void>` — hydrate all caches from disk at bootstrap
- `invalidatePath(path): void` — evict a path from every registered cache

### Watch Paths (`watchPaths.ts`)

- `watchTargetsFor(scope, home, projects): string[]` — compute directories to watch for a scope

---

## Engine Layer (`src/engine/`)

### Reference Graph (`engine/refs/`)

#### Types

```typescript
type RefSource =
  | { kind: 'frontmatter'; field: string }
  | { kind: 'import'; path: string }
  | { kind: 'tool'; tool: string }
  | { kind: 'matcher'; pattern: string }
  | { kind: 'prose' }

interface RawRef {
  toKind: Kind
  toName: string
  source: RefSource
}

interface Reference {
  from: string          // source entity id
  to: string            // target entity id (or __broken__:kind:name)
  kind: Kind            // target kind
  name: string          // target name
  source: RefSource     // how the reference was discovered
  broken: boolean       // true if target doesn't exist
}

interface EntityIndex {
  lookup: (kind: Kind, name: string) => AnyEntity | null
  namesByKind: (kind: Kind) => string[]
}

type ReferenceExtractor = (entity: AnyEntity, ctx: EntityIndex) => RawRef[]
```

#### Functions

- `buildReferenceGraph(entities): Reference[]` — build the full ref graph over all entities. Deduplicates, drops self-refs, marks broken targets.
- `referrersOf(entityId, refs): Reference[]` — who points at this entity
- `referencesFrom(entityId, refs): Reference[]` — what this entity points at
- `kindParticipatesInRefs(kind): boolean` — whether a kind can appear in the ref graph

### Validation (`engine/validate.ts`)

```typescript
interface ValidationResult<T> {
  ok: boolean
  value?: T
  errors: ValidationError[]
}

function validate<T>(schema: ZodType<T>, input: unknown): ValidationResult<T>
```

### Copy (`engine/copy.ts`)

- `copyEntity(entity, targetContext, targetScope): Promise<void>` — duplicate an entity to another scope

---

## Store (`src/app/store.ts`)

### State

| Field | Type | Description |
|-------|------|-------------|
| `home` | `string` | User's home directory |
| `ready` | `boolean` | True after bootstrap completes |
| `projects` | `Project[]` | All known projects |
| `scope` | `Scope` | Currently selected scope |
| `kind` | `Kind` | Currently selected kind |
| `selectedId` | `string \| null` | Selected entity id |
| `entities` | `EntitiesByKind` | All loaded entities, bucketed by kind |
| `refs` | `Reference[]` | Current reference graph |
| `search` | `string` | Active search query |
| `lastError` | `string \| null` | Last error message |
| `selections` | `Record<string, string>` | Remembered selections per scope+kind |
| `settings` | `Settings` | App settings |
| `pendingOps` | `Set<string>` | In-flight async operation keys |
| `loadingKinds` | `Set<Kind>` | Kinds currently being loaded |
| `activeTab` | `Record<string, string>` | Active tab per kind |

### Actions

| Action | Signature | Description |
|--------|-----------|-------------|
| `bootstrap` | `() => Promise<void>` | Initialize everything: home, projects, caches, UI state, reload, watcher |
| `refreshProjects` | `() => Promise<void>` | Re-read project list from `~/.claude.json` |
| `setScope` | `(scope) => void` | Switch scope, rewire watcher, reload |
| `setKind` | `(kind) => void` | Switch active kind, restore selection |
| `setSelected` | `(id \| null) => void` | Select an entity, persist to UI state |
| `setSearch` | `(s) => void` | Update search filter |
| `reload` | `() => Promise<void>` | Full re-read of all kinds for current scope |
| `updateEntity` | `(entity, next) => void` | Optimistic update + debounced write (350ms) |
| `createNew` | `(kind, input, value) => Promise<void>` | Create a new entity via adapter |
| `deleteExisting` | `(entity) => Promise<void>` | Delete entity via adapter |
| `copyToScope` | `(entity, target) => Promise<void>` | Copy entity to another scope |
| `moveToScope` | `(entity, target) => Promise<void>` | Copy + delete (move) |
| `createIn` | `(kind, value, target) => Promise<void>` | Create entity in a specific scope |
| `addProject` | `(path, name?) => Promise<void>` | Add project to `~/.claude.json` |
| `removeProject` | `(project) => Promise<void>` | Remove project from `~/.claude.json` |
| `updateSettings` | `(next) => void` | Update settings with debounced persist (300ms) |
| `runOp` | `<T>(key, fn) => Promise<T>` | Run async op with pending tracking |
| `setActiveTab` | `(kind, tabId) => void` | Set active tab for a kind |
| `saveEntity` | `(entity, next) => Promise<void>` | Immediate (non-debounced) write |

### CLI Operations (`cliOp.ts`)

```typescript
function runCliOp<T>(input: {
  key: string           // pendingOps key
  loading: string       // loading toast message
  success: string       // success toast message
  action: () => Promise<T>
  formatError?: (e: unknown) => string
  reload?: boolean      // default true
}): Promise<T>

function useIsOpPending(key: string): boolean   // reactive hook
```

---

## UI Descriptors (`src/ui-descriptors/`)

### UiDescriptor\<T\>

| Field | Type | Description |
|-------|------|-------------|
| `kind` | `Kind` | Which kind this describes |
| `newDefault` | `(name) => T` | Factory for new entity creation |
| `newLabel` | `string` | "New Agent" |
| `newPromptLabel` | `string` | "Agent name" |
| `listLabel` | `(v) => ReactNode` | List pane primary text |
| `listSublabel?` | `(v) => ReactNode` | List pane secondary text |
| `headerTitle?` | `(v) => ReactNode` | Inspector header override |
| `headerSubtitle?` | `(v) => ReactNode` | Subtitle override |
| `tabs?` | `ListTab<T>[]` | Tab strip configuration |
| `canDelete?` | `(v) => boolean` | Per-entity delete suppression |
| `Editor` | `Component<{ value, onChange, ctx }>` | The edit form component |
| `customActions?` | `(entity, ctx) => ContextMenuItem[]` | Context menu items |
| `headerActions?` | `(entity, ctx) => ContextMenuItem[]` | Header button overrides |

### EditorContext

```typescript
{
  knownAgents: string[]    // names of all agents in current scope
  knownCommands: string[]  // names of all commands in current scope
}
```

### ActionContext

```typescript
{
  scope: Scope
  projects: Project[]
  home: string
  createIn: (kind, value, scope) => Promise<void>
  remove: (entity) => Promise<void>
}
```

**Lookup:**
- `descriptors: Record<Kind, UiDescriptor<any>>`
- `descriptorFor<T>(kind): UiDescriptor<T>`

---

## Rust Commands (`src-tauri/src/commands.rs`)

All commands are async unless noted. Errors are returned as `String`.

| Command | Params | Returns | Notes |
|---------|--------|---------|-------|
| `home_dir` | — | `String` | sync |
| `read_text` | `path: String` | `String` | |
| `write_text` | `path, contents` | `()` | auto-creates parent dirs |
| `read_json` | `path: String` | `serde_json::Value` | |
| `write_json` | `path, value` | `()` | pretty-printed, auto-creates parents |
| `path_exists` | `path: String` | `bool` | |
| `ensure_dir` | `path: String` | `()` | recursive mkdir |
| `remove_path` | `path: String` | `()` | handles files and directories |
| `rename_path` | `from, to` | `()` | auto-creates target parent |
| `list_dir` | `path: String` | `Vec<DirEntry>` | with mtime/size stamps |
| `list_dir_recursive` | `path, max_depth?` | `Vec<DirEntry>` | default depth 8 |
| `find_files_named` | `root, name, max_depth?` | `Vec<DirEntry>` | parallel, gitignore-aware |
| `scan_for_projects` | `root, max_depth?` | `Vec<ProjectHit>` | parallel, sorted by path |
| `watch_paths` | `paths: Vec<String>` | `()` | replaces any existing watcher; sync |
| `unwatch_all` | — | `()` | sync |
| `open_external` | `target: String` | `()` | platform-specific (xdg-open/open/start) |
| `run_command` | `program, args, timeout_ms?` | `CliResult` | generic process spawner; uses `cmd /C` on Windows |
| `run_claude_cli` | `args, timeout_ms?` | `CliResult` | default 300s timeout |

### Ignored Directories

Both `find_files_named` and `scan_for_projects` skip:
`node_modules`, `target`, `dist`, `build`, `.git`, `.next`, `.cache`, `.deleted`, `__pycache__`
