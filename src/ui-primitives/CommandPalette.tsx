import { Command } from 'cmdk'
import { useEffect, useState, type ReactNode } from 'react'

export interface PaletteAction {
  id: string
  label: string
  hint?: string
  group?: string
  keywords?: string[]
  onSelect: () => void | Promise<void>
}

interface Props {
  actions: PaletteAction[]
  children?: ReactNode
}

export function CommandPalette({ actions }: Props) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [])

  if (!open) return null

  const groups = new Map<string, PaletteAction[]>()
  for (const a of actions) {
    const g = a.group ?? 'Actions'
    if (!groups.has(g)) groups.set(g, [])
    groups.get(g)!.push(a)
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[15vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-[640px] max-w-[90vw] bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <Command shouldFilter>
          <Command.Input
            placeholder="Type a command or search…"
            autoFocus
          />
          <Command.List className="max-h-[400px] overflow-auto py-1">
            <Command.Empty>No results.</Command.Empty>
            {[...groups.entries()].map(([group, items]) => (
              <Command.Group key={group} heading={group}>
                {items.map((a) => (
                  <Command.Item
                    key={a.id}
                    value={`${a.label} ${(a.keywords ?? []).join(' ')}`}
                    onSelect={() => {
                      setOpen(false)
                      void a.onSelect()
                    }}
                  >
                    <span className="flex-1">{a.label}</span>
                    {a.hint && <span className="text-xs text-zinc-500">{a.hint}</span>}
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
