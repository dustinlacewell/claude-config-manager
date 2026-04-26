# CCM Project Index

Complete file-by-file index of the Claude Code Manager codebase. Every source file is cataloged with its role, exports, size, and cross-references.

**Total**: ~11,400 lines TypeScript/TSX + ~600 lines Rust across 112 source files.

---

## Rust Backend (`src-tauri/`)

### `src-tauri/src/main.rs` (6 lines)
Entry point. Calls `ccm_lib::run()`.

### `src-tauri/src/lib.rs` (33 lines)
Tauri app builder. Registers plugins (`dialog`, `updater`, `process`), manages `WatcherState`, and binds all 16 IPC command handlers.

**Plugins**: `tauri_plugin_dialog`, `tauri_plugin_updater`, `tauri_plugin_process`

### `src-tauri/src/commands.rs` (514 lines)
All Rust IPC commands. The largest Rust file.

| Command | Lines | Description |
|---------|-------|-------------|
| `home_dir` | 49–54 | Returns `$HOME` (sync) |
| `read_text` | 57–59 | `tokio::fs::read_to_string` |
| `write_text` | 62–67 | Write with auto-mkdir parent |
| `read_json` | 70–73 | Read + `serde_json::from_str` |
| `write_json` | 76–82 | Pretty-print + write with auto-mkdir |
| `path_exists` | 85–87 | `tokio::fs::try_exists` |
| `ensure_dir` | 90–92 | `create_dir_all` |
| `remove_path` | 95–105 | Handles files and directories |
| `rename_path` | 108–113 | With auto-mkdir target parent |
| `list_dir` | 116–138 | Shallow listing with mtime/size |
| `list_dir_recursive` | 140–186 | Recursive walk (sequential, depth-limited) |
| `find_files_named` | 214–290 | Parallel gitignore-aware search (`ignore` crate) |
| `scan_for_projects` | 299–373 | Parallel scanner for `.claude/` + `CLAUDE.md` markers |
| `watch_paths` | 376–415 | `notify::RecommendedWatcher` setup (sync, replaces previous) |
| `unwatch_all` | 418–422 | Drop existing watcher (sync) |
| `open_external` | 427–460 | Platform-dispatch: `xdg-open` / `open` / `cmd start` |
| `run_claude_cli` | 475–513 | Spawn `claude` binary with timeout |

**Shared types**: `DirEntry` (name, path, is_dir, is_file, mtime, size), `FsChange` (kind, paths), `ProjectHit` (path, has_claude_md, has_claude_dir), `WatcherState`, `CliResult`

**Skipped directories**: `node_modules`, `target`, `dist`, `build`, `.git`, `.next`, `.cache`, `.deleted`, `__pycache__`

### `src-tauri/build.rs` (3 lines)
Standard Tauri build script.

### `src-tauri/capabilities/default.json` (14 lines)
Tauri permissions: `core:default`, `core:window:default`, `core:event:default`, `dialog:default`, `updater:default`, `process:default`.

---

## Ontology (`src/ontology/`) — 649 lines

The domain model layer. Zod schemas define types; `KindSpec` records wire them into the system.

### `core.ts` (41 lines)
Foundation types.

| Export | Type | Description |
|--------|------|-------------|
| `Kind` | Zod enum + type | 11-member discriminator |
| `Scope` | Zod discriminated union + type | `{type:'user'}` or `{type:'project', projectId}` |
| `scopeKey(s)` | function | `'user'` or `'project:<id>'` |
| `scopeEq(a, b)` | function | Structural equality |
| `Entity<T>` | interface | Universal wrapper: id, kind, scope, path, value, origin, raw, error?, dirty? |
| `AnyEntity` | type alias | `Entity<unknown>` |

### `schema.ts` (23 lines)
Shared schema utilities.

| Export | Description |
|--------|-------------|
| `LooseStringArray` | Zod preprocessor: `"a, b"` → `["a","b"]`, `["a","b"]` → `["a","b"]`, `""` → `[]` |

### `agent.ts` (21 lines)
Agent schema: `name`, `description`, `tools?` (LooseStringArray), `model?` (sonnet/opus/haiku/inherit), `color?`, `body`.

### `command.ts` (20 lines)
Command schema: `name`, `path`, `description`, `argumentHint?`, `allowedTools?`, `model?`, `body`.

### `skill.ts` (17 lines)
Skill schema: `name`, `description`, `license?`, `allowedTools?`, `body`.

### `rule.ts` (18 lines)
Rule schema: `name`, `path`, `description`, `paths?` (LooseStringArray), `body`.

### `hook.ts` (49 lines)
Hook schema: `event` (HookEvent enum: 8 events), `matcher`, `index`, `handlers[]` (each: type, command, timeout?).

### `mcp.ts` (24 lines)
MCP server schema: `name`, `type` (stdio/sse/http), `command`, `args[]`, `env{}`, `url?`, `enabled`.

### `plugin.ts` (74 lines)
Plugin schema (largest ontology file): `name`, `marketplace`, `state` (installed/available/both), `version?`, `scope?`, `installPath?`, `enabled`, `manifestFound`, `description?`, `author?`, `repository?`, `homepage?`, `keywords[]`, `license?`, `category?`, `source?`.

Utilities: `pluginKey(p)`, `isInstalled(p)`, `isAvailable(p)`.

### `marketplace.ts` (60 lines)
Marketplace schema: `name`, `source` (union of github/url/git-subdir/path/string), `installLocation?`, `lastUpdated?`.

Includes `MarketplaceSourceObject` discriminated union and `formatMarketplaceSource()`.

### `claudemd.ts` (14 lines)
CLAUDE.md schema: `name`, `relPath`, `body`.

### `memory.ts` (28 lines)
Memory schema: `name`, `description`, `type` (user/feedback/project/reference), `body`.

Utilities: `claudeProjectEncoding(path)` — `path.replace(/[\/\\:]/g, '-')`, `memorySlug(name)`.

### `conversation.ts` (13 lines)
Conversation schema: `sessionId`, `title`, `startTime`, `lastTime`, `turnCount`, `tokenCount?`, `projectDir`, `filePath`.

### `project.ts` (17 lines)
Project schema: `id`, `path`, `name`, `exists`.

Utilities: `projectIdOf(path)`, `projectNameOf(path)`.

### `catalog.ts` (16 lines)
Catalog entry schema: `id`, `type` (agent/skill/mcp), `name`, `description`, `author`, `tags[]`, `installData` (Record), `installed` (boolean, computed at read time).

### `settings.ts` (16 lines)
App settings schema: `anthropic.apiKey`, `markdownDefaultMode` (edit/read), `checkUpdatesOnStartup`, `markedPlugins[]`.

### `index.ts` (230 lines)
Barrel export + `KindSpec<T>` registrations for all 12 kinds. Defines `kindSpecs` record, `allKinds` array, and scope-query functions.

---

## Adapters (`src/adapters/`) — 3,503 lines

The I/O layer. Each kind has a dedicated adapter; shared infrastructure handles FS, frontmatter, and markdown.

### Core Infrastructure

#### `fs.ts` (110 lines)
Tauri IPC wrapper. 15 methods on the `fs` object, each calling `invoke()`. Write ops call `recordSelfWrite()`.

Utility functions: `readTextOrNull`, `readJsonOrNull`, `join`, `basename`, `dirname`, `stripExt`.

#### `fs.demo.ts` (273 lines)
In-memory mock FS for browser-only dev (`npm run dev`). Implements the same `fs.*` interface using Maps.

#### `fs.demo.fixture.ts` (1,069 lines)
Fixture data for the demo FS. Contains sample agents, commands, skills, rules, hooks, MCP servers, memories, conversations, and plugins.

#### `dialog.ts` (7 lines)
Wraps `@tauri-apps/plugin-dialog` `open()` for folder picker.

#### `dialog.demo.ts` (14 lines)
Mock dialog that returns a hardcoded path.

#### `frontmatter.ts` (43 lines)
YAML frontmatter parser/serializer.

- `parse<T>(text)` — tolerates BOM, returns `{data, body, hadFrontmatter}`
- `stringify(data, body)` — omits empty/null/undefined fields, no synthetic blank lines

#### `markdown.ts` (110 lines)
Shared adapter for directory-of-markdown kinds. `readMarkdownDir<T>(opts)` lists `.md` files, parses frontmatter, builds entities with file-stamp caching. `writeMarkdown(path, data, body)` serializes back.

Error handling: failed parses produce entities with `error` set and `value: {} as T`. Parse errors are NOT cached to persistent disk.

#### `selfWrites.ts` (30 lines)
Tracks self-written paths with 2-second TTL for watcher echo suppression.

- `recordSelfWrite(path)` — called before every write
- `isRecentSelfWrite(path)` — checked by watcher; lazily evicts expired entries

#### `paths.ts` (113 lines)
Centralized path computation. Exports path builders (`claudeDir`, `agentsDir`, `settingsPath`, etc.) and `kindsForPath()` which maps changed paths to affected entity kinds for targeted watcher reloads.

#### `tokenCounter.ts` (31 lines)
Token counting via Anthropic API. SHA-256 hashes content for cache key, calls `client.messages.countTokens()` with Haiku model. Results cached in `tokenCache`.

### Kind-Specific Adapters

#### `agentAdapter.ts` (46 lines)
Markdown adapter. Files in `.claude/agents/*.md`. Name-sanitizes with `clean()` regex.
Exports: `readAgents`, `writeAgent`, `deleteAgent`.

#### `commandAdapter.ts` (62 lines)
Markdown adapter. Files in `.claude/commands/**/*.md` (recursive). Supports subdirectory paths.
Exports: `readCommands`, `writeCommand`, `deleteCommand`.

#### `skillAdapter.ts` (115 lines)
Markdown adapter. Files in `.claude/skills/*.md`. Includes `emptySkill()` factory that generates frontmatter template.
Exports: `readSkills`, `writeSkill`, `deleteSkill`.

#### `ruleAdapter.ts` (58 lines)
Markdown adapter. Files in `.claude/rules/**/*.md` (recursive). Supports subdirectory paths.
Exports: `readRules`, `writeRule`, `deleteRule`.

#### `hookAdapter.ts` (87 lines)
JSON adapter. Embedded in `settings.json` → `hooks` object. Index-based identity (`event::matcher::index`). Write splices arrays; delete uses `splice`.
Exports: `readHooks`, `writeHook`, `deleteHook`.

#### `mcpAdapter.ts` (111 lines)
JSON adapter. User scope: `~/.claude.json` → `mcpServers`. Project scope: `.mcp.json` → `mcpServers`. Read-modify-write on the parent JSON file.
Exports: `readMcpServers`, `writeMcpServer`, `deleteMcpServer`.

#### `pluginAdapter.ts` (298 lines)
The most complex adapter. Merges three data sources:
1. `installed_plugins.json` — installation registry
2. `settings.json` → `enabledPlugins` — enabled state
3. Marketplace catalogs — available plugins

Entities have state: `installed`, `available`, or `both`. Write updates `installed_plugins.json` + `settings.json` atomically.
Exports: `readPlugins`, `writePlugin`, `deletePlugin`.

#### `marketplaceAdapter.ts` (101 lines)
JSON adapter. Reads `known_marketplaces.json`. Create/delete shell out to `claude plugin marketplace add/remove` via `fs.runClaudeCli()`.
Exports: `readMarketplaces`, `writeMarketplace`, `deleteMarketplace`.

#### `claudemdAdapter.ts` (97 lines)
Markdown adapter with special handling. User scope reads `~/.claude/CLAUDE.md` + imports. Project scope uses `findFilesNamed` (parallel Rust walker) to find all `CLAUDE.md` files recursively.
Exports: `readClaudeMds`, `writeClaudeMd`, `deleteClaudeMd`.

#### `memoryAdapter.ts` (160 lines)
Markdown adapter. Files in `~/.claude/projects/<encoded>/memory/*.md`. Uses `claudeProjectEncoding()` for directory mapping. Supports `memorySlug()` for filename generation.
Exports: `readMemories`, `writeMemoryEntry`, `deleteMemoryEntry`.

#### `conversationAdapter.ts` (363 lines)
The largest adapter. Two-phase progressive loading:
1. **Fast path**: list `.jsonl` files, check persistent cache by (mtime, size), return skeleton entities
2. **Enrichment**: background workers parse JSONL lines, extract title/turns/tokens, update cache

Also exports conversation message parsing (`parseConversationMessages`), tool result loading (`fetchToolResults`), prefetch (`prefetchConversation`), and JSONL parsing types (`ParsedMessage`, `ToolUse`).

Includes `isSystemInjection()` filter for `<ide_*>`, `<system*>`, `<user-prompt*>` blocks.

#### `catalogAdapter.ts` (55 lines)
Hybrid adapter. Merges bundled entries from `data/catalog.ts` with live skills.sh entries from `skillsShScraper.ts`. Batch-checks installed status via three parallel calls (list agents dir, list skills dir, read MCP config). Write/create/delete are no-ops (read-only kind).
Exports: `readCatalog`.

#### `skillsShScraper.ts` (80 lines)
Fetches the skills.sh leaderboard HTML via `curl` through Rust `run_command` IPC, parses SSR HTML with a regex to extract skill entries (name, repo, rank, install count). In-memory cache with manual invalidation. Returns `[]` on failure (network error, demo mode).
Exports: `fetchSkillsSh`, `invalidateSkillsShCache`.

### `index.ts` (215 lines)
Barrel + dispatch. Four parallel `switch` statements: `readByKind`, `writeEntity`, `createEntity`, `deleteEntity`. Also `readAll`. Catalog cases are no-ops for write/create/delete.

---

## Data (`src/data/`) — 230 lines

### `catalog.ts` (230 lines)
Bundled catalog entries: 5 agents (code-reviewer, test-generator, doc-writer, refactoring-helper, security-auditor), 5 skills (tdd, conventional-commits, explain-code, debug, api-design), 7 MCP servers (filesystem, brave-search, github, puppeteer, memory, sequential-thinking, sqlite). Each entry's `installData` matches the target kind's Zod schema.

---

## Registry (`src/registry/`) — 480 lines

State outside the entity model. Caches, project lists, UI persistence.

### `projects.ts` (53 lines)
Reads `~/.claude.json` for project list. `loadProjects`, `addManualProject`, `removeManualProject`, `resolveLocation`.

### `uiState.ts` (31 lines)
Persists UI selections to `~/.config/ccm/ui-state.json`. `loadUiState`, `saveUiState`, `scopeFromKey`.

### `settings.ts` (14 lines)
App settings at `~/.config/ccm/config.json`. `loadSettings`, `saveSettings`. Uses Zod `safeParse` with fallback to defaults.

### `watchPaths.ts` (11 lines)
`watchTargetsFor(scope, home, projects)` — returns directories to watch. User scope: `~/.claude` + `~/.claude.json`. Project scope: `{project}/.claude` + `{project}/.mcp.json`.

### `persistentCache.ts` (124 lines)
Generic mtime/size-stamped persistent cache framework. `createPersistentCache<T>(name)` registers a namespace. `initPersistentCaches(home)` hydrates from disk at bootstrap. `invalidatePath(path)` evicts cross-namespace.

Schema versioned (`CACHE_VERSION = 2`). Writes debounced at 500ms. Storage: `~/.config/ccm/<name>.cache.json`.

### `fileCache.ts` (31 lines)
Wraps `persistentCache` for markdown entity values. Namespace: `file-cache`.

### `conversationMetaCache.ts` (38 lines)
Wraps `persistentCache` for conversation metadata. Namespace: `conversation-meta`. Type: `ConversationMeta` (title, startTime, lastTime, turnCount, tokenCount).

### `conversationCache.ts` (57 lines)
In-memory LRU cache for parsed conversation messages. Max 50 entries. LRU bump on access. Tracks in-flight promises for deduplication.

### `toolResultCache.ts` (56 lines)
In-memory LRU cache for tool_result blocks. Max 10 entries. Same LRU + dedup pattern as conversation cache.

### `tokenCache.ts` (30 lines)
Simple JSON-backed cache for token counts, keyed by SHA-256 hash. Storage: `~/.config/ccm/token-cache.json`. Debounced save at 500ms.

### `index.ts` (10 lines)
Barrel export for all registry modules.

---

## Engine (`src/engine/`) — 430 lines

Cross-entity analysis: reference graph, validation, copy.

### `validate.ts` (21 lines)
`validate<T>(schema, input)` — Zod safeParse wrapper returning `{ok, value?, errors[]}`.

### `copy.ts` (10 lines)
`copyEntity(entity, targetContext, targetScope)` — delegates to `createEntity`.

### `refs/types.ts` (37 lines)
Type definitions for the reference graph.

- `RefSource` — discriminated union: frontmatter, import, tool, matcher, prose
- `RawRef` — unresolved reference (toKind, toName, source)
- `Reference` — resolved reference (from, to, kind, name, source, broken)
- `EntityIndex` — lookup interface (lookup by kind+name, list names by kind)
- `ReferenceExtractor` — function type `(entity, ctx) => RawRef[]`

### `refs/graph.ts` (63 lines)
`buildReferenceGraph(entities)` — two-phase algorithm:
1. Index all entities by (kind, name)
2. Run each kind's extractor, resolve raw refs, deduplicate, drop self-refs, mark broken

### `refs/queries.ts` (24 lines)
- `referrersOf(entityId, refs)` — incoming references
- `referencesFrom(entityId, refs)` — outgoing references
- `kindParticipatesInRefs(kind)` — whether a kind can appear in the graph

Kinds that can be referenced: agent, command, skill, hook, mcp, memory, claudemd, rule.

### `refs/frontmatter.ts` (26 lines)
Frontmatter field extraction for reference extractors. Re-parses `entity.raw` since Zod schemas don't carry all reference-bearing fields.

- `frontmatterOf(raw)` — parse raw to frontmatter data
- `fmStringList(fm, key)` — extract string array (handles comma-separated)
- `fmString(fm, key)` — extract single string

### `refs/scanners.ts` (92 lines)
Text-scanning functions for reference discovery.

| Scanner | Pattern | Produces |
|---------|---------|----------|
| `scanImports` | `@path/to/file.md` | refs to claudemd, rule, memory |
| `scanMcpTools` | `mcp__server__tool` | refs to mcp servers |
| `scanProseCommands` | `/commandName` | refs to commands |
| `scanProseAgents` | `subagent_type: "name"` | refs to agents |
| `scanProseSkills` | `skill: name` | refs to skills |

### `refs/extractors.ts` (151 lines)
Per-kind reference extractors. Registry of 7 extractors (agent, command, skill, rule, claudemd, memory, hook). Each combines frontmatter field refs, MCP tool refs, import refs, and prose scanning.

Notable: `agent` extractor checks `tools`, `skills`, `mcpServers`, `hooks`, `memory` frontmatter fields. `hook` extractor scans matcher patterns and handler commands.

### `refs/index.ts` (3 lines)
Barrel export.

### `index.ts` (3 lines)
Barrel export.

---

## UI Primitives (`src/ui-primitives/`) — 1,468 lines

Reusable, kind-agnostic components.

### `util.ts` (16 lines)
`cn(...classes)` — className merge utility (filters falsy, joins with space).

### `index.ts` (20 lines)
Barrel export for all primitives + global dialog state (prompt/context-menu/scan/settings openers).

### `Field.tsx` (47 lines)
Labeled form field wrapper. Props: `label`, `hint?`, `children`.

### `InlineText.tsx` (63 lines)
Inline editable text input. Renders as text, clicks to edit. Props: `value`, `onChange`, `placeholder?`, `mono?`.

### `InlineSelect.tsx` (85 lines)
Inline dropdown. Props: `value`, `onChange`, `options[]`, `placeholder?`.

### `InlineTags.tsx` (89 lines)
Tag/chip editor for string arrays. Comma-separated input, backspace to remove. Props: `value`, `onChange`, `placeholder?`, `suggestions?`.

### `KeyValueEditor.tsx` (58 lines)
Editable key-value pair list. Add/remove rows. Props: `value: Record<string,string>`, `onChange`.

### `ArrayEditor.tsx` (45 lines)
Ordered string list editor. Add/remove/reorder. Props: `value: string[]`, `onChange`.

### `Switch.tsx` (41 lines)
Toggle switch. Props: `checked`, `onChange`, `label?`, `disabled?`.

### `ColorDot.tsx` (37 lines)
Small colored circle indicator. Maps named colors to Tailwind classes.

### `FilePath.tsx` (40 lines)
Click-to-copy file path display. Shows toast on copy.

### `ExternalLink.tsx` (44 lines)
Clickable link opening URLs/paths via `fs.openExternal()`. Orange accent color.

### `List.tsx` (55 lines)
Entity list. Props: `items[]`, `selectedId`, `onSelect`, `onHover?`, `onContextMenu?`, `empty`. Renders badges and error indicators.

### `Inspector.tsx` (35 lines)
Right-pane inspector wrapper. Props: `title`, `subtitle`, `actions?`, `children`.

### `ProseEditor.tsx` (81 lines)
CodeMirror 6 markdown editor. Dark theme, controlled value, debounced onChange.

### `CommandPalette.tsx` (80 lines)
`cmdk`-based command palette. Groups actions, keyboard shortcut (`Cmd+K`). Props: `actions: PaletteAction[]`.

### `ContextMenu.tsx` (178 lines)
Right-click context menu system. Supports submenus, destructive actions, disabled items, pending spinners, active state.

Global state: `openContextMenu(event, items[])`, `<ContextMenuHost />`.

### `PromptDialog.tsx` (86 lines)
Text-input dialog for entity creation. `prompt(title, opts)` returns a Promise. Props: `title`, `placeholder?`, `initialValue?`.

### `ScanDialog.tsx` (165 lines)
Folder-scanning dialog for project discovery. Runs `scanForProjects()`, displays hits with checkboxes, bulk-add.

### `SettingsDialog.tsx` (215 lines)
App settings modal. API key input, markdown mode toggle, update check, version display. Imports version from `package.json`.

### Markdown Submodule (`markdown/`)

#### `MarkdownView.tsx` (46 lines)
`react-markdown` + `remark-gfm` + custom `remarkAlerts`. Renders to styled dark-theme HTML.

#### `CodeBlock.tsx` (30 lines)
Shiki-highlighted code block with async language loading. Falls back to plain `<pre>` while loading.

#### `shiki.ts` (44 lines)
Async Shiki highlighter. `highlight(code, lang)` and `highlightCached(code, lang)` with LRU HTML cache.

#### `shikiSync.ts` (144 lines)
Synchronous Shiki tokenizer.

- `useShikiLang(lang)` — React hook, returns highlighter when ready
- `tokenizeLineSync(h, line, lang)` — per-line tokenization with 2000-entry cache
- `highlightLineHtml(h, line, lang)` — HTML string with color spans + `escapeHtml`
- `langFromPath(path)` — maps file extensions to Shiki language IDs (50+ mappings)

#### `alerts.ts` (35 lines)
Custom remark plugin for GitHub-style callouts (`> [!NOTE]`, `> [!WARNING]`, etc.).

#### `FrontmatterPanel.tsx` (34 lines)
Renders parsed frontmatter as a styled key-value table above markdown content.

---

## UI Descriptors (`src/ui-descriptors/`) — 1,869 lines

Per-kind UI configuration. Each file defines a `UiDescriptor<T>` with editor component.

### `types.ts` (52 lines)
`UiDescriptor<T>` interface, `EditorContext`, `ActionContext`, `ListTab<T>`.

### `knowledge.ts` (54 lines)
Constants shared across descriptors: `KNOWN_TOOLS` (18 built-in tools), `MODEL_OPTIONS`, `AGENT_COLORS`, `HOOK_EVENTS`, `MCP_TRANSPORTS`.

### `index.ts` (33 lines)
Descriptor registry. `descriptors: Record<Kind, UiDescriptor<any>>`, `descriptorFor<T>(kind)`.

### `agent.tsx` (68 lines)
Agent editor: name, description, tools (InlineTags with KNOWN_TOOLS suggestions), model (InlineSelect), color (InlineSelect with AGENT_COLORS), body (ProseEditor).

### `command.tsx` (73 lines)
Command editor: name, path, description, argument hint, allowed tools, model, body.

### `skill.tsx` (47 lines)
Skill editor: name, description, body (raw markdown with frontmatter preserved).

### `rule.tsx` (47 lines)
Rule editor: name, path, description, paths (InlineTags), body.

### `hook.tsx` (93 lines)
Hook editor: event (InlineSelect), matcher, handlers (ArrayEditor-like with command + timeout per handler).

### `mcp.tsx` (73 lines)
MCP editor: name, type (InlineSelect), command, args (InlineTags), env (KeyValueEditor), URL (shown for sse/http).

### `plugin.tsx` (410 lines)
The largest descriptor. Multi-tab: All / Installed / Available / Marked. Header actions: Enable/Disable toggle, Install, Uninstall, Mark for Update. Uses `runCliOp` for CLI operations. Custom action: Open Homepage. Shows install path, version, marketplace, author, keywords, license, category.

### `marketplace.tsx` (63 lines)
Marketplace editor: name (read-only after creation), source (display only), install location, last updated. Custom actions: Refresh, Remove (via CLI).

### `claudemd.tsx` (22 lines)
CLAUDE.md editor: name (read-only), body (ProseEditor in markdown mode).

### `memory.tsx` (78 lines)
Memory editor: name, description, type (InlineSelect: user/feedback/project/reference), body. Raw markdown editing with frontmatter.

### `conversation.tsx` (826 lines)
The most complex descriptor. Read-only. Multi-tab: All / Recent (7 days). Features:
- Timeline view with parsed messages and tool uses
- Syntax-highlighted tool inputs (Shiki, async per-language)
- Lazy-loaded tool results with expand/collapse
- Diff viewer for Edit tool calls (react-diff-viewer-continued)
- Copy-to-project action
- Token count display
- Predictive prefetch on hover (120ms delay)

### `catalog.tsx` (175 lines)
Catalog browser. Read-only. Multi-tab: All / Agents / Skills / MCP / skills.sh. Features:
- Type badges (Agent/Skill/MCP Server) with color coding
- "skills.sh" badge on live entries
- Install button: bundled entries write via target kind adapter; skills.sh entries install via `skills add` CLI
- Installed checkmark indicator (computed from disk state)
- "View on skills.sh" link for live entries
- Header actions: Browse skills.sh (opens browser), Install from GitHub (prompt + CLI), Refresh (invalidates cache)
- Install data preview (expandable JSON)

---

## App Shell (`src/app/`) — 1,505 lines

Top-level orchestration.

### `store.ts` (684 lines)
Zustand store — the largest file in the project. Single source of truth.

**State**: home, ready, projects, scope, kind, selectedId, entities (11 buckets), refs, search, lastError, selections, settings, pendingOps, loadingKinds, activeTab.

**Actions** (16): bootstrap, refreshProjects, setScope, setKind, setSelected, setSearch, reload, updateEntity, createNew, deleteExisting, copyToScope, moveToScope, createIn, addProject, removeProject, updateSettings, runOp, setActiveTab, saveEntity.

**Key mechanisms**:
- Debounced entity writes (350ms) with dirty-flag tracking
- `mergeBucket` — preserves dirty entities across watcher reloads
- `refreshKinds` — targeted reload of specific kinds (not full rescan)
- `runEnrichment` — bounded-concurrency background conversation parsing (8 workers)
- `flushPendingRefresh` — coalesces watcher events → targeted kind reloads
- `scheduleUiSave` — debounced UI state persistence (250ms)
- `stillCurrent` guards on all async operations to handle scope switches

### `cliOp.ts` (50 lines)
`runCliOp<T>(input)` — wraps CLI actions with toast feedback, pending-op tracking, and auto-reload. `useIsOpPending(key)` reactive hook.

### `updater.ts` (122 lines)
Tauri auto-update integration. Abstracts real updater vs dev mocks. Scenarios: `real`, `available`, `none`, `error`. Download progress tracking with toast updates. Mock mode for previewing update UX.

### `palette/index.ts` (199 lines)
Command palette action builder. Groups: Switch scope, Jump to, Create, Current (delete/copy), Projects (add/scan/refresh), View (reload/settings/updates). Dev-only mock update actions.

### Shell Components

#### `shell/Shell.tsx` (71 lines)
Root component. Three-pane layout + overlays. Error banner, command palette, context menu, prompt dialog, scan dialog, settings dialog, toaster.

#### `shell/Sidebar.tsx` (229 lines)
Left pane. Scope selector (Global + projects) with add/scan/remove. Kind navigation with entity counts and loading spinners. Settings gear button. Inline SVG icons (gear, search/scan, spinner).

#### `shell/ListPane.tsx` (201 lines)
Middle pane. Filtered/searchable entity list with tabs, "New" button, context menus (copy/move/delete). Predictive conversation prefetch on 120ms hover. Uses `copyMoveTargets` for scope menus.

#### `shell/EditPane.tsx` (284 lines)
Right pane. Inspector with descriptor's Editor component. Reference graph display (incoming/outgoing). Token count (debounced 500ms). Header actions (custom + copy/move/delete). Scope action dropdown menus. Reference row display with source-type tags.

#### `shell/targets.ts` (50 lines)
`copyMoveTargets(entity, projects)` — computes valid scope targets for copy/move. `effectiveSourceScope` resolves conversations to their true project scope even in user-aggregate view.

---

## Entry Points

### `src/main.tsx` (10 lines)
React root. Renders `<App />` into `#root`.

### `src/App.tsx` (16 lines)
Wraps `<Shell />`. No routing — single-page app.

### `src/env.d.ts` (9 lines)
Vite client types + `VITE_DEMO` env var declaration.

### `vite.config.ts` (59 lines)
Vite configuration. Path alias `@/` → `src/`. Conditional Tauri host config. Demo mode builds with `VITE_DEMO=1` and swaps `fs.ts` → `fs.demo.ts`, `dialog.ts` → `dialog.demo.ts`.

---

## Dependency Graph

```
App Shell (store, shell, palette, updater)
  ├── UI Descriptors (per-kind Editor + config)
  │     └── UI Primitives (Field, List, Inspector, ProseEditor, ...)
  │           └── markdown/ (MarkdownView, CodeBlock, Shiki, alerts)
  ├── Engine (refs, validate, copy)
  │     └── Ontology (schemas, types, KindSpec)
  ├── Adapters (per-kind read/write/delete)
  │     ├── Ontology (schemas for parsing)
  │     ├── Registry (caches for perf)
  │     └── fs.ts → Rust IPC
  └── Registry (projects, uiState, settings, caches)
        └── Adapters (fs for I/O)
```

**No circular dependencies.** The dependency flow is strictly downward. Ontology has zero imports from other layers. Adapters import Ontology + Registry. Engine imports Ontology + Adapters. UI Descriptors import everything except Store. Store imports everything.

---

## Cross-Reference: Where Each Kind Is Defined

| Kind | Schema | Adapter | Descriptor | Extractor | Lines (total) |
|------|--------|---------|------------|-----------|---------------|
| agent | `ontology/agent.ts` (21) | `agentAdapter.ts` (46) | `agent.tsx` (68) | `extractors.ts` | ~186 |
| command | `ontology/command.ts` (20) | `commandAdapter.ts` (62) | `command.tsx` (73) | `extractors.ts` | ~206 |
| skill | `ontology/skill.ts` (17) | `skillAdapter.ts` (115) | `skill.tsx` (47) | `extractors.ts` | ~230 |
| rule | `ontology/rule.ts` (18) | `ruleAdapter.ts` (58) | `rule.tsx` (47) | `extractors.ts` | ~174 |
| hook | `ontology/hook.ts` (49) | `hookAdapter.ts` (87) | `hook.tsx` (93) | `extractors.ts` | ~280 |
| mcp | `ontology/mcp.ts` (24) | `mcpAdapter.ts` (111) | `mcp.tsx` (73) | (target only) | ~208 |
| plugin | `ontology/plugin.ts` (74) | `pluginAdapter.ts` (298) | `plugin.tsx` (410) | — | ~782 |
| marketplace | `ontology/marketplace.ts` (60) | `marketplaceAdapter.ts` (101) | `marketplace.tsx` (63) | — | ~224 |
| claudemd | `ontology/claudemd.ts` (14) | `claudemdAdapter.ts` (97) | `claudemd.tsx` (22) | `extractors.ts` | ~184 |
| memory | `ontology/memory.ts` (28) | `memoryAdapter.ts` (160) | `memory.tsx` (78) | `extractors.ts` | ~317 |
| conversation | `ontology/conversation.ts` (13) | `conversationAdapter.ts` (363) | `conversation.tsx` (826) | — | ~1,202 |
| catalog | `ontology/catalog.ts` (16) | `catalogAdapter.ts` (55) + `skillsShScraper.ts` (80) + `data/catalog.ts` (230) | `catalog.tsx` (175) | — | ~556 |

---

## Storage Locations

| What | Path | Format |
|------|------|--------|
| Project list | `~/.claude.json` | JSON (keys of `projects` object) |
| User agents | `~/.claude/agents/*.md` | Frontmatter markdown |
| User commands | `~/.claude/commands/**/*.md` | Frontmatter markdown (recursive) |
| User skills | `~/.claude/skills/*.md` | Frontmatter markdown |
| User rules | `~/.claude/rules/**/*.md` | Frontmatter markdown (recursive) |
| User hooks | `~/.claude/settings.json` → `hooks` | JSON (embedded) |
| User MCP servers | `~/.claude.json` → `mcpServers` | JSON (embedded) |
| Project MCP servers | `{project}/.mcp.json` → `mcpServers` | JSON (embedded) |
| Installed plugins | `~/.claude/plugins/installed_plugins.json` | JSON |
| Plugin enabled state | `~/.claude/settings.json` → `enabledPlugins` | JSON (embedded) |
| Known marketplaces | `~/.claude/plugins/known_marketplaces.json` | JSON |
| Memories | `~/.claude/projects/{encoded}/memory/*.md` | Frontmatter markdown |
| Conversations | `~/.claude/projects/{encoded}/*.jsonl` | JSONL |
| User CLAUDE.md | `~/.claude/CLAUDE.md` | Markdown |
| Project CLAUDE.md | `{project}/CLAUDE.md` (+ nested) | Markdown |
| App settings | `~/.config/ccm/config.json` | JSON |
| UI state | `~/.config/ccm/ui-state.json` | JSON |
| File cache | `~/.config/ccm/file-cache.cache.json` | JSON |
| Conversation meta cache | `~/.config/ccm/conversation-meta.cache.json` | JSON |
| Token cache | `~/.config/ccm/token-cache.json` | JSON |
| Catalog (bundled) | `src/data/catalog.ts` (compiled into app) | TypeScript array |
| Catalog (live) | Fetched from `https://skills.sh` via `curl` | In-memory cache (not persisted) |
