import { allKinds, kindSpecs, type Entity } from '@/ontology'
import { descriptorFor } from '@/ui-descriptors'
import { openScanDialog, openSettingsDialog, prompt, type PaletteAction } from '@/ui-primitives'
import { useStore } from '@/app/store'
import { pickDirectory } from '@/adapters/dialog'
import { fs } from '@/adapters'
import { toast } from 'sonner'
import { checkForUpdates, setUpdateScenario } from '@/app/updater'

export const buildPaletteActions = (): PaletteAction[] => {
  const state = useStore.getState()
  const {
    projects,
    scope,
    kind,
    setScope,
    setKind,
    createNew,
    deleteExisting,
    copyToScope,
    entities,
    selectedId,
    addProject,
    refreshProjects,
    reload,
  } = state

  const actions: PaletteAction[] = []

  actions.push({
    id: 'scope:user',
    group: 'Switch scope',
    label: 'Global (~/.claude)',
    onSelect: () => setScope({ type: 'user' }),
  })
  for (const p of projects) {
    actions.push({
      id: `scope:${p.id}`,
      group: 'Switch scope',
      label: p.name,
      hint: p.path,
      keywords: [p.path],
      onSelect: () => setScope({ type: 'project', projectId: p.id }),
    })
  }

  for (const k of allKinds) {
    actions.push({
      id: `kind:${k}`,
      group: 'Jump to',
      label: kindSpecs[k].pluralLabel,
      onSelect: () => setKind(k),
    })
  }

  for (const k of allKinds) {
    if (kindSpecs[k].readOnly) continue
    if (kindSpecs[k].noCreate) continue
    const d = descriptorFor(k)
    actions.push({
      id: `new:${k}`,
      group: 'Create',
      label: d.newLabel,
      onSelect: async () => {
        const input = await prompt(d.newLabel, { placeholder: d.newPromptLabel })
        if (!input) return
        await createNew(k, input, d.newDefault(input))
        toast.success(`Created ${k}: ${input}`)
      },
    })
  }

  const current = selectedId
    ? ((entities as any)[kind] as Entity<any>[]).find((e) => e.id === selectedId)
    : null
  if (current && !kindSpecs[kind].readOnly) {
    actions.push({
      id: 'current:delete',
      group: 'Current',
      label: 'Delete current',
      onSelect: async () => {
        await deleteExisting(current)
        toast.success('Deleted')
      },
    })
    if (scope.type !== 'user') {
      actions.push({
        id: 'current:copy-to-user',
        group: 'Current',
        label: 'Copy to Global',
        onSelect: async () => {
          await copyToScope(current, { type: 'user' })
          toast.success('Copied to Global')
        },
      })
    }
    for (const p of projects) {
      if (scope.type === 'project' && scope.projectId === p.id) continue
      actions.push({
        id: `current:copy-${p.id}`,
        group: 'Current',
        label: `Copy to ${p.name}`,
        hint: p.path,
        onSelect: async () => {
          await copyToScope(current, { type: 'project', projectId: p.id })
          toast.success(`Copied to ${p.name}`)
        },
      })
    }
  }

  actions.push({
    id: 'project:add',
    group: 'Projects',
    label: 'Add project…',
    onSelect: async () => {
      const path = await pickDirectory()
      if (!path) return
      await addProject(path)
      toast.success('Project added')
    },
  })
  actions.push({
    id: 'project:scan',
    group: 'Projects',
    label: 'Scan folder for projects…',
    hint: 'Find CLAUDE.md / .claude/',
    onSelect: async () => {
      const root = await pickDirectory()
      if (!root) return
      await openScanDialog(root, (r) => fs.scanForProjects(r))
    },
  })
  actions.push({
    id: 'project:refresh',
    group: 'Projects',
    label: 'Refresh project list',
    onSelect: async () => {
      await refreshProjects()
      toast.success('Projects refreshed')
    },
  })
  actions.push({
    id: 'reload',
    group: 'View',
    label: 'Reload current scope',
    onSelect: async () => {
      await reload()
      toast.success('Reloaded')
    },
  })
  actions.push({
    id: 'settings',
    group: 'View',
    label: 'Settings…',
    onSelect: () => openSettingsDialog(),
  })
  actions.push({
    id: 'updates:check',
    group: 'View',
    label: 'Check for updates…',
    onSelect: () => {
      setUpdateScenario('real')
      checkForUpdates()
    },
  })

  if (import.meta.env.DEV) {
    actions.push({
      id: 'dev:mock-update-available',
      group: 'Dev',
      label: 'Mock: update available',
      onSelect: () => {
        setUpdateScenario('available')
        checkForUpdates()
      },
    })
    actions.push({
      id: 'dev:mock-update-none',
      group: 'Dev',
      label: 'Mock: no update',
      onSelect: () => {
        setUpdateScenario('none')
        checkForUpdates()
      },
    })
    actions.push({
      id: 'dev:mock-update-error',
      group: 'Dev',
      label: 'Mock: update check error',
      onSelect: () => {
        setUpdateScenario('error')
        checkForUpdates()
      },
    })
  }

  return actions
}
