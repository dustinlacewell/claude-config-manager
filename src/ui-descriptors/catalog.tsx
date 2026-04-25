import { useState } from 'react'
import type { UiDescriptor, ListTab } from './types'
import type { CatalogEntry, Kind } from '@/ontology'
import { useStore } from '@/app/store'
import { cn } from '@/ui-primitives/util'

const TYPE_LABELS: Record<CatalogEntry['type'], string> = {
  agent: 'Agent',
  skill: 'Skill',
  mcp: 'MCP Server',
}

const TYPE_COLORS: Record<CatalogEntry['type'], string> = {
  agent: 'bg-violet-900/60 text-violet-300',
  skill: 'bg-sky-900/60 text-sky-300',
  mcp: 'bg-emerald-900/60 text-emerald-300',
}

function TypeBadge({ type }: { type: CatalogEntry['type'] }) {
  return (
    <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', TYPE_COLORS[type])}>
      {TYPE_LABELS[type]}
    </span>
  )
}

function CatalogEditor({
  value,
}: {
  value: CatalogEntry
  onChange: (next: CatalogEntry) => void
  ctx: any
}) {
  const createNew = useStore((s) => s.createNew)
  const reload = useStore((s) => s.reload)
  const [installing, setInstalling] = useState(false)

  const handleInstall = async () => {
    setInstalling(true)
    try {
      const targetKind: Kind = value.type === 'mcp' ? 'mcp' : value.type
      await createNew(targetKind, value.name, value.installData)
      await reload()
    } finally {
      setInstalling(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <TypeBadge type={value.type} />
        {value.author && <span className="text-xs text-zinc-500">by {value.author}</span>}
      </div>

      <p className="text-sm text-zinc-300">{value.description}</p>

      {value.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.tags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="pt-2">
        {value.installed ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-emerald-400">
            <CheckIcon /> Installed
          </span>
        ) : (
          <button
            onClick={handleInstall}
            disabled={installing}
            className={cn(
              'text-sm px-3 py-1.5 rounded font-medium',
              installing
                ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                : 'bg-orange-600 hover:bg-orange-500 text-white',
            )}
          >
            {installing ? 'Installing...' : `Install ${TYPE_LABELS[value.type]}`}
          </button>
        )}
      </div>

      <details className="pt-2">
        <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-300">
          Preview install data
        </summary>
        <pre className="mt-2 text-[11px] font-mono text-zinc-400 bg-zinc-900 rounded p-3 overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify(value.installData, null, 2)}
        </pre>
      </details>
    </div>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

const tabs: ListTab<CatalogEntry>[] = [
  { id: 'all', label: 'All', predicate: () => true },
  { id: 'agents', label: 'Agents', predicate: (v) => v.type === 'agent' },
  { id: 'skills', label: 'Skills', predicate: (v) => v.type === 'skill' },
  { id: 'mcp', label: 'MCP', predicate: (v) => v.type === 'mcp' },
]

export const catalogDescriptor: UiDescriptor<CatalogEntry> = {
  kind: 'catalog',
  newDefault: () => ({ id: '', type: 'agent', name: '', installData: {}, tags: [], installed: false }),
  newLabel: '',
  newPromptLabel: '',
  tabs,
  listLabel: (v) => v.name,
  listSublabel: (v) => (
    <span className="flex items-center gap-1.5">
      <TypeBadge type={v.type} />
      {v.installed && <span className="text-[10px] text-emerald-500">installed</span>}
    </span>
  ),
  Editor: CatalogEditor,
}
