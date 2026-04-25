# Claude Code Manager

A desktop app for managing Claude Code configuration files across all your projects.

Browse, edit, and organize agents, commands, skills, rules, hooks, MCP servers, plugins, memories, conversations, and CLAUDE.md files — in one place, with live reload.

## Features

- **Three-pane interface** — scope selector, entity list, inline editor
- **Two scopes** — global (`~/.claude/`) and per-project (`.claude/`)
- **11 config kinds** — agents, commands, skills, rules, hooks, MCP servers, plugins, marketplaces, CLAUDE.md files, memories, conversations
- **Live editing** — changes auto-save with 350ms debounce, no save button
- **File watching** — external changes (from Claude Code, git, etc.) appear instantly
- **Reference graph** — see which entities reference each other, with broken-link warnings
- **Cross-scope copy/move** — drag configs between global and project scopes
- **Command palette** — `Cmd+K` for fast navigation and actions
- **Conversation viewer** — browse session history with syntax-highlighted tool calls and diffs
- **Token counting** — see how many tokens each config file consumes (requires API key)
- **Plugin management** — install, enable/disable, and browse marketplace plugins
- **Auto-updates** — built-in update checker via GitHub releases

## Install

Download the latest release for your platform from [GitHub Releases](https://github.com/dustinlacewell/claude-config-manager/releases).

## Development

**Prerequisites**: Node.js 20+, Rust 1.77+, [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/)

```bash
npm install
npm run tauri:dev     # Full dev build (Rust + Vite with HMR)
npm run dev           # Vite only (UI iteration, no Tauri runtime)
npx tsc --noEmit      # Type-check
npm run tauri:build   # Production build
```

## Architecture

Six layers with strict contracts:

```
App Shell (Zustand store, three-pane layout)
  ├── UI Descriptors (per-kind editor components)
  │     └── UI Primitives (Field, List, Inspector, CodeMirror, Shiki, ...)
  ├── Engine (reference graph, validation, cross-scope copy)
  ├── Adapters (per-kind FS read/write via Rust IPC)
  │     └── Registry (persistent caches, project list, UI state)
  └── Ontology (Zod schemas + types for every config kind)

Rust Backend (async FS, file watcher, parallel project scanner, CLI bridge)
```

See [`docs/`](docs/) for detailed documentation:

- [Architecture Guide](docs/ARCHITECTURE.md) — system boundary, data flows, caching strategy
- [API Reference](docs/API-REFERENCE.md) — every type, function, and Rust command
- [Developer Guide](docs/DEVELOPER-GUIDE.md) — how to add new config kinds, extend the reference graph
- [Project Index](docs/INDEX.md) — file-by-file catalog of all 107 source files

## Tech Stack

- **Tauri v2** — Rust shell with async FS, `notify` file watcher, `ignore` crate for parallel walks
- **React 19** + **Vite 6** + **Tailwind v4**
- **Zustand** — global state management
- **Zod** — runtime schema validation for all config types
- **CodeMirror 6** — markdown editing
- **Shiki** — syntax highlighting (one-dark-pro theme, lazy language loading)
- **cmdk** — command palette
- **sonner** — toast notifications

## License

MIT
