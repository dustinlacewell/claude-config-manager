import { create } from 'zustand'
import {
  fs,
  readByKind,
  readConversations,
  enrichConversation,
  writeEntity as adapterWrite,
  createEntity as adapterCreate,
  deleteEntity as adapterDelete,
  isRecentSelfWrite,
  kindsForPath,
  type ConversationEnrichJob,
  type Location,
  type WriteContext,
} from '@/adapters'
import {
  loadProjects,
  addManualProject,
  removeManualProject,
  resolveLocation,
  watchTargetsFor,
  loadUiState,
  saveUiState,
  scopeFromKey,
  loadSettings,
  saveSettings,
  initTokenCache,
  initPersistentCaches,
  invalidateConversation,
  invalidateToolResults,
  invalidatePath,
} from '@/registry'
import {
  allKinds,
  allKindsForScope,
  kindSupportsScope,
  defaultSettings,
  type AnyEntity,
  type Entity,
  type Kind,
  type Project,
  type Scope,
  type Settings,
  scopeEq,
  scopeKey,
} from '@/ontology'
import { buildReferenceGraph, entityExistsAt, type Reference } from '@/engine'
import { confirm } from '@/ui-primitives'

interface EntitiesByKind {
  claudemd: Entity<any>[]
  memory: Entity<any>[]
  agent: Entity<any>[]
  command: Entity<any>[]
  skill: Entity<any>[]
  rule: Entity<any>[]
  hook: Entity<any>[]
  mcp: Entity<any>[]
  plugin: Entity<any>[]
  marketplace: Entity<any>[]
  conversation: Entity<any>[]
  catalog: Entity<any>[]
}

const emptyBuckets = (): EntitiesByKind => ({
  claudemd: [],
  memory: [],
  agent: [],
  command: [],
  skill: [],
  rule: [],
  hook: [],
  mcp: [],
  plugin: [],
  marketplace: [],
  conversation: [],
  catalog: [],
})

interface State {
  home: string
  ready: boolean
  projects: Project[]
  scope: Scope
  kind: Kind
  selectedId: string | null
  entities: EntitiesByKind
  refs: Reference[]
  search: string
  lastError: string | null
  selections: Record<string, string>
  settings: Settings
  /**
   * In-flight async operations keyed by `<op>:<target>` (e.g. `install:open-prose@prose`).
   * Reactive — UI subscribes to check whether a specific button should show a spinner
   * or be disabled. Set semantics so concurrent ops on different targets coexist.
   */
  pendingOps: Set<string>
  /**
   * Kinds whose read is still in flight for the current scope. The sidebar
   * watches this to swap the count for a spinner. `reload` marks all kinds
   * loading on entry and clears each as its read settles.
   */
  loadingKinds: Set<Kind>
  /** Active tab id per kind (kinds with `tabs` on their descriptor). */
  activeTab: Record<string, string>
}

interface Actions {
  bootstrap: () => Promise<void>
  refreshProjects: () => Promise<void>
  setScope: (scope: Scope) => void
  setKind: (kind: Kind) => void
  setSelected: (id: string | null) => void
  setSearch: (s: string) => void
  reload: () => Promise<void>
  updateEntity: (entity: Entity<any>, next: any) => void
  createNew: (kind: Kind, input: string, value: any) => Promise<void>
  deleteExisting: (entity: Entity<any>) => Promise<void>
  copyToScope: (entity: Entity<any>, target: Scope) => Promise<void>
  moveToScope: (entity: Entity<any>, target: Scope) => Promise<void>
  createIn: (kind: Kind, value: any, target: Scope) => Promise<void>
  addProject: (path: string, name?: string) => Promise<void>
  removeProject: (project: Project) => Promise<void>
  updateSettings: (next: Settings) => void
  /**
   * Run an async operation while marking it pending in `pendingOps`. The caller
   * supplies a stable key (e.g. `install:open-prose@prose`) that UI can observe
   * to render spinners / disable buttons specific to that target.
   */
  runOp: <T>(key: string, fn: () => Promise<T>) => Promise<T>
  setActiveTab: (kind: Kind, tabId: string) => void
  /**
   * Persist a new entity value immediately (no debounce, no optimistic update).
   * Use when a mutation needs to happen *durably before* the UI reflects it —
   * e.g. plugin enable/disable, where an orange "in-progress" indicator only
   * makes sense if we don't lie with an optimistic flip.
   */
  saveEntity: (entity: Entity<any>, next: any) => Promise<void>
}

type Store = State & Actions

const USER_SCOPE: Scope = { type: 'user' }

const selectionKey = (scope: Scope, kind: Kind): string =>
  `${scopeKey(scope)}::${kind}`

const resolveContext = (s: State): { loc: Location; home: string } | null => {
  const loc = resolveLocation(s.scope, s.home, s.projects)
  if (!loc) return null
  return { loc, home: s.home }
}

const confirmIfCollides = async (
  ctx: WriteContext,
  kind: Kind,
  value: any,
  verb: 'copy' | 'move' | 'create',
): Promise<boolean> => {
  const hit = await entityExistsAt(ctx, kind, value)
  if (!hit) return true
  const verbTitle =
    verb === 'copy' ? 'Copy' : verb === 'move' ? 'Move' : 'Create'
  return confirm({
    title: `Overwrite existing ${kind}?`,
    body: `${verbTitle} would overwrite:\n${hit.where}`,
    confirmLabel: 'Overwrite',
    danger: true,
  })
}

const resolveSelection = (
  buckets: EntitiesByKind,
  scope: Scope,
  kind: Kind,
  selections: Record<string, string>,
  currentId: string | null,
): string | null => {
  const list = buckets[kind]
  if (currentId && list.find((e) => e.id === currentId)) return currentId
  const remembered = selections[selectionKey(scope, kind)]
  if (remembered && list.find((e) => e.id === remembered)) return remembered
  return list[0]?.id ?? null
}

const writeTimers = new Map<string, ReturnType<typeof setTimeout>>()
let reloadTimer: ReturnType<typeof setTimeout> | null = null
let saveUiTimer: ReturnType<typeof setTimeout> | null = null
let saveSettingsTimer: ReturnType<typeof setTimeout> | null = null

const withoutKind = (set: Set<Kind>, kind: Kind): Set<Kind> => {
  const next = new Set(set)
  next.delete(kind)
  return next
}

const patchBucket = (
  buckets: EntitiesByKind,
  kind: Kind,
  list: Entity<any>[],
): EntitiesByKind => ({ ...buckets, [kind]: list })

/**
 * Reconciles a fresh bucket read from disk with the in-memory bucket. Any
 * entity that is currently `dirty` (unsaved user edit) is retained — the
 * in-flight write will eventually land on disk and a later watcher event will
 * bring the two back in sync. Without this, an external watcher event in the
 * middle of typing would snap the editor back to the last-saved value.
 */
const mergeBucket = (
  previous: Entity<any>[],
  fresh: Entity<any>[],
): Entity<any>[] => {
  const dirty = new Map<string, Entity<any>>()
  for (const e of previous) if (e.dirty) dirty.set(e.id, e)
  if (dirty.size === 0) return fresh
  return fresh.map((f) => dirty.get(f.id) ?? f)
}

/** Max concurrent conversation enrichments — bounded to keep IPC humane. */
const ENRICH_CONCURRENCY = 8

/**
 * Background pool that parses conversation files to populate title / turn /
 * token metadata. Each completion is pushed to the store via `onEnriched` so
 * the list updates progressively. Aborts as soon as `isCurrent` returns false
 * (i.e. user switched scope).
 */
const runEnrichment = async (
  jobs: ConversationEnrichJob[],
  isCurrent: () => boolean,
  onEnriched: (entity: Entity<any>) => void,
): Promise<void> => {
  let cursor = 0
  const worker = async () => {
    while (isCurrent()) {
      const i = cursor++
      if (i >= jobs.length) return
      try {
        const enriched = await enrichConversation(jobs[i]!)
        if (!enriched || !isCurrent()) continue
        onEnriched(enriched)
      } catch {
        // best-effort: a single enrichment failure shouldn't block others
      }
    }
  }
  const width = Math.min(ENRICH_CONCURRENCY, jobs.length)
  await Promise.all(Array.from({ length: width }, worker))
}

/**
 * Accumulates external change paths across watcher fires so a burst (e.g. a
 * multi-file git operation) coalesces into a single refresh.
 */
const pendingRefreshPaths = new Set<string>()

/**
 * Re-reads only the kinds whose source data actually changed and commits all
 * buckets in a single `setState` so the UI re-renders once, not eleven times.
 * Does NOT touch `loadingKinds` — a targeted refresh is silent; the count in
 * the sidebar goes from N to N (or N±1 for a create/delete) atomically,
 * without flicker.
 *
 * Dirty entities (unsaved user edits) are preserved across the refresh via
 * `mergeBucket`.
 */
const refreshKinds = async (kinds: Set<Kind>): Promise<void> => {
  const state = useStore.getState()
  const ctx = resolveContext(state)
  if (!ctx) return
  const startScope = state.scope
  const stillCurrent = (): boolean =>
    scopeEq(useStore.getState().scope, startScope)

  let enrichJobs: ConversationEnrichJob[] = []
  const results = await Promise.all(
    Array.from(kinds).map(async (k) => {
      try {
        if (k === 'conversation') {
          const { entities, jobs } = await readConversations(ctx.loc, ctx.home)
          enrichJobs = jobs
          return [k, entities] as const
        }
        return [k, await readByKind(k, ctx.loc, ctx.home)] as const
      } catch {
        return null
      }
    }),
  )
  if (!stillCurrent()) return

  useStore.setState((s) => {
    let entities = s.entities
    for (const r of results) {
      if (!r) continue
      const [k, list] = r
      entities = patchBucket(entities, k, mergeBucket(s.entities[k], list))
    }
    const selectedId = resolveSelection(
      entities,
      s.scope,
      s.kind,
      s.selections,
      s.selectedId,
    )
    const all = Object.values(entities).flat() as AnyEntity[]
    return { entities, selectedId, refs: buildReferenceGraph(all) }
  })

  if (enrichJobs.length > 0) {
    void runEnrichment(enrichJobs, stillCurrent, (entity) => {
      useStore.setState((s) => ({
        entities: patchBucket(
          s.entities,
          'conversation',
          s.entities.conversation.map((e) =>
            e.path === entity.path ? entity : e,
          ),
        ),
      }))
    })
  }
}

const flushPendingRefresh = async (): Promise<void> => {
  if (pendingRefreshPaths.size === 0) return
  const paths = Array.from(pendingRefreshPaths)
  pendingRefreshPaths.clear()
  const state = useStore.getState()
  const ctx = resolveContext(state)
  if (!ctx) return
  const kinds = new Set<Kind>()
  for (const p of paths) {
    for (const k of kindsForPath(p, ctx.loc, ctx.home)) kinds.add(k)
  }
  if (kinds.size === 0) return
  await refreshKinds(kinds)
}

const scheduleUiSave = (state: State) => {
  if (saveUiTimer) clearTimeout(saveUiTimer)
  saveUiTimer = setTimeout(() => {
    if (!state.home) return
    void saveUiState(state.home, {
      selections: state.selections,
      lastScopeKey: scopeKey(state.scope),
      lastKind: state.kind,
    })
  }, 250)
}

export const useStore = create<Store>((set, get) => ({
  home: '',
  ready: false,
  projects: [],
  scope: USER_SCOPE,
  kind: 'claudemd',
  selectedId: null,
  entities: emptyBuckets(),
  refs: [],
  search: '',
  lastError: null,
  selections: {},
  settings: defaultSettings(),
  pendingOps: new Set<string>(),
  loadingKinds: new Set<Kind>(),
  activeTab: {},

  bootstrap: async () => {
    try {
      const home = await fs.homeDir()
      set({ home })
      await Promise.all([
        get().refreshProjects(),
        initTokenCache(home),
        initPersistentCaches(home),
      ])
      const ui = await loadUiState(home)
      const settings = await loadSettings(home)
      set({ settings })
      const restoredScope =
        (ui.lastScopeKey && scopeFromKey(ui.lastScopeKey)) || USER_SCOPE
      const rawKind = (ui.lastKind as Kind) ?? 'claudemd'
      const restoredKind = kindSupportsScope(rawKind, restoredScope)
        ? rawKind
        : (allKindsForScope(restoredScope)[0] ?? 'claudemd')
      set({ scope: restoredScope, kind: restoredKind, selections: ui.selections })
      await get().reload()
      const targets = watchTargetsFor(get().scope, home, get().projects)
      await fs.watchPaths(targets)
      await fs.onChange((ev) => {
        // Caches are path-keyed and cheap to invalidate — do it unconditionally
        // so even suppressed self-writes don't leave stale cache entries.
        for (const path of ev.paths) {
          invalidatePath(path)
          if (path.endsWith('.jsonl')) {
            invalidateConversation(path)
            invalidateToolResults(path)
          }
        }
        // Drop the echoes of our own writes; no refresh needed for those.
        const external = ev.paths.filter((p) => !isRecentSelfWrite(p))
        if (external.length === 0) return
        for (const p of external) pendingRefreshPaths.add(p)
        if (reloadTimer) clearTimeout(reloadTimer)
        reloadTimer = setTimeout(() => void flushPendingRefresh(), 150)
      })
      set({ ready: true })
    } catch (e) {
      set({ lastError: e instanceof Error ? e.message : String(e) })
    }
  },

  refreshProjects: async () => {
    const projects = await loadProjects(get().home)
    set({ projects })
  },

  setScope: (scope) => {
    if (scopeEq(scope, get().scope)) return
    set((s) => {
      const kind = kindSupportsScope(s.kind, scope)
        ? s.kind
        : (allKindsForScope(scope)[0] ?? s.kind)
      return {
        scope,
        kind,
        selectedId: null,
        entities: emptyBuckets(),
        refs: [],
        loadingKinds: new Set<Kind>(allKinds),
      }
    })
    scheduleUiSave(get())
    void (async () => {
      await get().reload()
      const targets = watchTargetsFor(scope, get().home, get().projects)
      await fs.watchPaths(targets)
    })()
  },

  setKind: (kind) => {
    set((s) => {
      if (!kindSupportsScope(kind, s.scope)) return {}
      const selected = resolveSelection(
        s.entities,
        s.scope,
        kind,
        s.selections,
        null,
      )
      return { kind, selectedId: selected, search: '' }
    })
    scheduleUiSave(get())
  },

  setSelected: (id) => {
    set((s) => {
      if (!id) return { selectedId: null }
      const next = { ...s.selections, [selectionKey(s.scope, s.kind)]: id }
      return { selectedId: id, selections: next }
    })
    scheduleUiSave(get())
  },

  setSearch: (s) => set({ search: s }),

  reload: async () => {
    const state = get()
    const ctx = resolveContext(state)
    if (!ctx) {
      set({
        entities: emptyBuckets(),
        refs: [],
        selectedId: null,
        loadingKinds: new Set(),
      })
      return
    }
    const reloadScope = state.scope
    const stillCurrent = () => scopeEq(get().scope, reloadScope)

    set({ loadingKinds: new Set<Kind>(allKinds) })

    const commitKind = (k: Kind, list: Entity<any>[]) => {
      set((s) => {
        const entities = patchBucket(s.entities, k, list)
        return {
          entities,
          loadingKinds: withoutKind(s.loadingKinds, k),
          selectedId: resolveSelection(
            entities,
            s.scope,
            s.kind,
            s.selections,
            s.selectedId,
          ),
        }
      })
    }

    const clearLoading = (k: Kind, err?: unknown) => {
      set((s) => ({
        loadingKinds: withoutKind(s.loadingKinds, k),
        lastError:
          err === undefined
            ? s.lastError
            : err instanceof Error
              ? err.message
              : String(err),
      }))
    }

    let enrichJobs: ConversationEnrichJob[] = []

    const tasks = allKinds.map(async (k) => {
      try {
        if (k === 'conversation') {
          const { entities, jobs } = await readConversations(ctx.loc, ctx.home)
          if (!stillCurrent()) return
          enrichJobs = jobs
          commitKind('conversation', entities)
          return
        }
        const list = await readByKind(k, ctx.loc, ctx.home)
        if (!stillCurrent()) return
        commitKind(k, list)
      } catch (e) {
        if (!stillCurrent()) return
        clearLoading(k, e)
      }
    })

    await Promise.all(tasks)
    if (!stillCurrent()) return

    const all = Object.values(get().entities).flat() as AnyEntity[]
    set({ refs: buildReferenceGraph(all), lastError: null })

    if (enrichJobs.length > 0) {
      void runEnrichment(enrichJobs, stillCurrent, (entity) => {
        set((s) => ({
          entities: patchBucket(
            s.entities,
            'conversation',
            s.entities.conversation.map((e) =>
              e.path === entity.path ? entity : e,
            ),
          ),
        }))
      })
    }
  },

  updateEntity: (entity, next) => {
    set((s) => {
      const list = (s.entities as any)[entity.kind] as Entity<any>[]
      const updated = list.map((e) =>
        e.id === entity.id ? { ...e, value: next, dirty: true } : e,
      )
      return { entities: { ...s.entities, [entity.kind]: updated } }
    })
    const key = entity.id
    const prev = writeTimers.get(key)
    if (prev) clearTimeout(prev)
    writeTimers.set(
      key,
      setTimeout(async () => {
        const ctx = resolveContext(get())
        if (!ctx) return
        try {
          const current = (get().entities as any)[entity.kind].find(
            (e: Entity<any>) => e.id === entity.id,
          ) as Entity<any> | undefined
          const value = current?.value ?? next
          const writeCtx: WriteContext = { loc: ctx.loc, home: ctx.home }
          await adapterWrite(writeCtx, entity, value)
          // Clear `dirty` only if no further edit landed while we were writing.
          // If `current.value` is still what we just wrote, the user has stopped
          // typing and the on-disk state matches memory — the orange dot can go
          // away. If it changed, a later debounce will own the clear.
          set((s) => {
            const list = (s.entities as any)[entity.kind] as Entity<any>[]
            const idx = list.findIndex((e) => e.id === entity.id)
            if (idx < 0) return {}
            const item = list[idx]!
            if (!item.dirty || item.value !== value) return {}
            const cleaned = list.slice()
            cleaned[idx] = { ...item, dirty: false, origin: value }
            return { entities: { ...s.entities, [entity.kind]: cleaned } }
          })
        } catch (e) {
          set({ lastError: e instanceof Error ? e.message : String(e) })
        }
      }, 350),
    )
  },

  createNew: async (kind, _input, value) => {
    const ctx = resolveContext(get())
    if (!ctx) return
    try {
      await adapterCreate({ loc: ctx.loc, home: ctx.home }, kind, value)
      await refreshKinds(new Set([kind]))
      set({ kind })
    } catch (e) {
      set({ lastError: e instanceof Error ? e.message : String(e) })
    }
  },

  deleteExisting: async (entity) => {
    const ctx = resolveContext(get())
    if (!ctx) return
    try {
      await adapterDelete({ loc: ctx.loc, home: ctx.home }, entity)
      if (get().selectedId === entity.id) set({ selectedId: null })
      await refreshKinds(new Set([entity.kind]))
    } catch (e) {
      set({ lastError: e instanceof Error ? e.message : String(e) })
    }
  },

  copyToScope: async (entity, target) => {
    const state = get()
    const targetLoc = resolveLocation(target, state.home, state.projects)
    if (!targetLoc) return
    const ctx = { loc: targetLoc, home: state.home }
    if (!(await confirmIfCollides(ctx, entity.kind, entity.value, 'copy'))) return
    try {
      await adapterCreate(ctx, entity.kind, entity.value)
    } catch (e) {
      set({ lastError: e instanceof Error ? e.message : String(e) })
    }
  },

  moveToScope: async (entity, target) => {
    const state = get()
    const targetLoc = resolveLocation(target, state.home, state.projects)
    if (!targetLoc) return
    const ctx = { loc: targetLoc, home: state.home }
    if (!(await confirmIfCollides(ctx, entity.kind, entity.value, 'move'))) return
    try {
      await adapterCreate(ctx, entity.kind, entity.value)
    } catch (e) {
      set({ lastError: e instanceof Error ? e.message : String(e) })
      return
    }
    await get().deleteExisting(entity)
  },

  createIn: async (kind, value, target) => {
    const state = get()
    const targetLoc = resolveLocation(target, state.home, state.projects)
    if (!targetLoc) return
    const ctx = { loc: targetLoc, home: state.home }
    if (!(await confirmIfCollides(ctx, kind, value, 'create'))) return
    try {
      await adapterCreate(ctx, kind, value)
      // Only refresh if the target scope is the one currently on screen;
      // otherwise the change is off-screen and will be picked up when the
      // user switches to that scope.
      if (scopeEq(target, state.scope)) {
        await refreshKinds(new Set([kind]))
      }
    } catch (e) {
      set({ lastError: e instanceof Error ? e.message : String(e) })
    }
  },

  addProject: async (path, name) => {
    await addManualProject(get().home, path, name)
    await get().refreshProjects()
  },

  removeProject: async (project) => {
    await removeManualProject(get().home, project.path)
    await get().refreshProjects()
  },

  updateSettings: (next) => {
    set({ settings: next })
    if (saveSettingsTimer) clearTimeout(saveSettingsTimer)
    saveSettingsTimer = setTimeout(() => {
      const { home, settings } = get()
      if (home) void saveSettings(home, settings)
    }, 300)
  },

  setActiveTab: (kind, tabId) =>
    set((s) => ({ activeTab: { ...s.activeTab, [kind]: tabId } })),

  saveEntity: async (entity, next) => {
    const ctx = resolveContext(get())
    if (!ctx) throw new Error('No location for scope')
    await adapterWrite({ loc: ctx.loc, home: ctx.home }, entity, next)
  },

  runOp: async (key, fn) => {
    if (get().pendingOps.has(key)) {
      throw new Error(`${key} is already in progress`)
    }
    set((s) => ({ pendingOps: new Set(s.pendingOps).add(key) }))
    try {
      return await fn()
    } finally {
      set((s) => {
        const next = new Set(s.pendingOps)
        next.delete(key)
        return { pendingOps: next }
      })
    }
  },
}))
