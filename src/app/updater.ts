import { toast } from 'sonner'

// A minimal handle that abstracts over Tauri's real updater and the dev mock.
// Everything the presentation cares about (version, body, download progress)
// lives here; real-vs-mock is a single switch in `check()` below.
type UpdateHandle = {
  version: string
  body: string
  simulated: boolean
  downloadAndInstall: (
    onProgress: (e: { event: 'Started' | 'Progress' | 'Finished'; data?: any }) => void,
  ) => Promise<void>
}

export type UpdateScenario = 'real' | 'available' | 'none' | 'error'
let scenario: UpdateScenario = 'real'
export const setUpdateScenario = (s: UpdateScenario) => {
  scenario = s
}

let hasChecked = false

export async function checkForUpdates(opts: { silent?: boolean } = {}) {
  if (hasChecked && opts.silent) return
  hasChecked = true

  let handle: UpdateHandle | null
  try {
    handle = await check()
  } catch (err) {
    if (!opts.silent) toast.error(`Couldn't check for updates: ${String(err)}`)
    return
  }

  if (!handle) {
    if (!opts.silent) toast.success('You are on the latest version.')
    return
  }

  const id = toast(`Update available: v${handle.version}`, {
    description: handle.body || 'A new version is ready to install.',
    duration: Infinity,
    action: {
      label: 'Install & restart',
      onClick: () => {
        install(handle, id).catch((err) => toast.error(`Install failed: ${String(err)}`))
      },
    },
  })
}

async function install(handle: UpdateHandle, toastId: string | number) {
  const progressId = toast.loading('Downloading update…', { id: toastId, duration: Infinity })
  let downloaded = 0
  let contentLength = 0
  await handle.downloadAndInstall((event) => {
    switch (event.event) {
      case 'Started':
        contentLength = event.data?.contentLength ?? 0
        break
      case 'Progress':
        downloaded += event.data?.chunkLength ?? 0
        if (contentLength) {
          const pct = Math.round((downloaded / contentLength) * 100)
          toast.loading(`Downloading update… ${pct}%`, { id: progressId, duration: Infinity })
        }
        break
      case 'Finished':
        toast.loading('Installing…', { id: progressId, duration: Infinity })
        break
    }
  })
  if (handle.simulated || import.meta.env.VITE_DEMO) {
    toast.success('Mock install complete (no relaunch in dev).', { id: progressId, duration: 4000 })
    return
  }
  const { relaunch } = await import('@tauri-apps/plugin-process')
  await relaunch()
}

// ── real vs mock dispatch ─────────────────────────────────────────────────────

async function check(): Promise<UpdateHandle | null> {
  if (scenario === 'none') return null
  if (scenario === 'error') throw new Error('Simulated updater failure (dev mock).')
  if (scenario === 'available') return mockAvailable()
  return await checkReal()
}

async function checkReal(): Promise<UpdateHandle | null> {
  // Demo builds run in a browser with no Tauri runtime. Never attempt to
  // import the updater plugin — its top-level code assumes the host app.
  if (import.meta.env.VITE_DEMO) return null
  const { check: tauriCheck } = await import('@tauri-apps/plugin-updater')
  const u = await tauriCheck()
  if (!u) return null
  return {
    version: u.version,
    body: u.body ?? '',
    simulated: false,
    downloadAndInstall: (cb) => u.downloadAndInstall(cb as any),
  }
}

function mockAvailable(): UpdateHandle {
  return {
    version: '0.99.0-mock',
    body: 'Simulated update for previewing the update UX.\n\n- Demo note A\n- Demo note B',
    simulated: true,
    async downloadAndInstall(cb) {
      const total = 10_000_000
      const chunk = total / 20
      cb({ event: 'Started', data: { contentLength: total } })
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 120))
        cb({ event: 'Progress', data: { chunkLength: chunk } })
      }
      cb({ event: 'Finished' })
      await new Promise((r) => setTimeout(r, 400))
    },
  }
}
