# CCM — Claude Code Manager

A Tauri desktop app for managing Claude Code configuration files across all your projects.

## Commands

```bash
npm run tauri:dev    # Start dev build (Rust + Vite)
npm run tauri:build  # Production build
npm run dev          # Vite only (no Tauri, for UI iteration)
npx tsc --noEmit    # Type-check
```

## Architecture

Six layers, each with a strict contract:

| Layer | Path | Role |
|---|---|---|
| Ontology | `src/ontology/` | Zod schemas + types for every config kind |
| Adapters | `src/adapters/` | FS read/write per kind; thin Rust bridge via `fs.*` |
| Registry | `src/registry/` | Projects list, UI state, app settings |
| Engine | `src/engine/` | Reference graph, validation, copy helpers |
| UI Primitives | `src/ui-primitives/` | Generic field components, dialogs, markdown |
| UI Descriptors | `src/ui-descriptors/` | Per-kind mapping of fields → primitives |
| App Shell | `src/app/` | Store (Zustand), three-pane layout |

The Rust layer (`src-tauri/src/commands.rs`) is intentionally thin — async FS ops, a file watcher, parallel project scanning via the `ignore` crate, and a generic `run_command` for spawning external tools (e.g. `skills` CLI, `curl`).

## Adding a New Config Kind

1. `src/ontology/{kind}.ts` — Zod schema + type
2. `src/ontology/index.ts` — add `KindSpec`, register in `kindSpecs` and `allKinds`
3. `src/ontology/core.ts` — add to `Kind` enum
4. `src/adapters/{kind}Adapter.ts` — `read*`, `write*`, `delete*`
5. `src/adapters/index.ts` — wire into `readAll`, `readByKind`, `writeEntity`, `createEntity`, `deleteEntity`
6. `src/ui-descriptors/{kind}.tsx` — `UiDescriptor<T>` with `Editor` component
7. `src/ui-descriptors/index.ts` — add to `descriptors` record
8. `src/app/store.ts` — add bucket to `EntitiesByKind` and `emptyBuckets()`

9. `src/engine/collision.ts` — add case to `entityExistsAt` switch (return `null` for read-only kinds)

Read-only kinds (e.g. `conversation`, `catalog`): set `readOnly: true` on `KindSpec`. The shell and palette automatically hide create/edit/delete for these.

## Key Patterns

**Entity identity** — Every `Entity<T>` carries `origin: T` (the value at load time). Adapters must use `entity.origin` (not `entity.value`) to locate the artifact on disk during rename/delete. This prevents identity bugs when users edit fields like `name` before saving.

**Live editing** — `updateEntity` in the store debounces writes at 350ms. No save button.

**Scope** — Two scope types: `user` (global `~/.claude/`) and `project` (`{project}/.claude/`). `KindSpec.validScopes` controls which sidebar sections show a kind.

**Claude's project encoding** — `~/.claude/projects/` uses `path.replace(/[\/\\:]/g, '-')` as directory names. Used by memory and conversation adapters.

**File watching** — Rust emits `fs:change` events; store debounces reloads at 250ms.

## Data Sources

| What | Where |
|---|---|
| Project list | `~/.claude.json` — keys of the `projects` object |
| User configs | `~/.claude/` — agents, commands, skills, rules, settings.json |
| Project configs | `{project}/.claude/` — same structure |
| Memories | `~/.claude/projects/{encoded}/memory/*.md` |
| Conversations | `~/.claude/projects/{encoded}/*.jsonl` |
| App settings | `~/.config/ccm/config.json` |
| UI state | `~/.config/ccm/ui-state.json` |
| Catalog (bundled) | `src/data/catalog.ts` — 17 curated agents, skills, MCP configs |
| Catalog (live) | Fetched from `https://skills.sh` via `curl` at startup |

## Tech Stack

- **Tauri v2** — Rust shell, `@tauri-apps/plugin-dialog` for folder picker
- **React 19** + **Vite 6** + **Tailwind v4**
- **Zustand** — global store
- **Zod** — runtime schema validation for all config types
- **CodeMirror 6** — markdown editing
- **Shiki** — syntax highlighting in markdown preview (one-dark-pro, LRU cached)
- **react-markdown** + **remark-gfm** + custom `remarkAlerts` plugin for GitHub-style callouts
- **sonner** — toasts
- **cmdk** — command palette
