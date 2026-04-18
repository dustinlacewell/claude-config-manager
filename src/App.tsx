import { useEffect } from 'react'
import { Shell } from './app/shell/Shell'
import { checkForUpdates } from './app/updater'
import { useStore } from './app/store'

export default function App() {
  const checkOnStartup = useStore((s) => s.settings.checkUpdatesOnStartup)
  useEffect(() => {
    if (!checkOnStartup) return
    // Check a few seconds after mount so the window has a chance to settle
    // before the toast appears.
    const t = setTimeout(() => checkForUpdates(), 3000)
    return () => clearTimeout(t)
  }, [checkOnStartup])
  return <Shell />
}
