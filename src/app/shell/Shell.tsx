import { useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { ListPane } from './ListPane'
import { EditPane } from './EditPane'
import { useStore } from '@/app/store'
import {
  CommandPalette,
  ConfirmHost,
  ContextMenuHost,
  PromptHost,
  ScanDialogHost,
  SettingsDialog,
} from '@/ui-primitives'
import { Toaster, toast } from 'sonner'
import { buildPaletteActions } from '@/app/palette'
import { checkForUpdates, setUpdateScenario } from '@/app/updater'

export function Shell() {
  const bootstrap = useStore((s) => s.bootstrap)
  const ready = useStore((s) => s.ready)
  const lastError = useStore((s) => s.lastError)
  const addProject = useStore((s) => s.addProject)
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  const actions = buildPaletteActions()

  if (!ready) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
        Loading…
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {lastError && (
        <div className="bg-red-900/40 border-b border-red-800 text-red-200 text-xs px-4 py-1">
          {lastError}
        </div>
      )}
      <div className="flex-1 flex min-h-0">
        <Sidebar />
        <ListPane />
        <EditPane />
      </div>
      <CommandPalette actions={actions} />
      <ContextMenuHost />
      <PromptHost />
      <ConfirmHost />
      <ScanDialogHost
        onAdd={async (paths) => {
          for (const p of paths) await addProject(p)
          toast.success(`Added ${paths.length} project${paths.length === 1 ? '' : 's'}`)
        }}
      />
      <SettingsDialog
        settings={settings}
        onChange={updateSettings}
        onCheckForUpdates={() => {
          setUpdateScenario('real')
          checkForUpdates()
        }}
      />
      <Toaster theme="dark" position="bottom-right" />
    </div>
  )
}
